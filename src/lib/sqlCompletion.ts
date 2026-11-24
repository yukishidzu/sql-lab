import type { Completion, CompletionContext, CompletionResult, CompletionSource } from '@codemirror/autocomplete'

type Clause = 'SELECT' | 'FROM' | 'JOIN' | 'WHERE' | 'GROUP BY' | 'ORDER BY' | 'INSERT INTO' | 'UPDATE' | 'DELETE FROM' | 'SET' | 'CREATE TABLE' | 'ALTER TABLE' | 'START'

const recommendations: Record<Clause, string[]> = {
  SELECT: ['DISTINCT', 'COUNT', 'AVG', 'SUM', 'MIN', 'MAX', 'COALESCE', 'NULLIF', 'DATE_TRUNC', 'EXTRACT', 'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'LAG', 'LEAD', 'OVER', 'PARTITION BY', '*', 'FROM'],
  FROM: ['JOIN', 'LEFT JOIN', 'WHERE', 'GROUP BY', 'ORDER BY', 'LIMIT'],
  JOIN: ['ON', 'JOIN', 'LEFT JOIN', 'WHERE'],
  WHERE: ['AND', 'OR', 'IS NULL', 'IS NOT NULL', 'LIKE', 'ILIKE', 'IN', 'BETWEEN', 'EXISTS', 'COALESCE', 'NULLIF'],
  'GROUP BY': ['HAVING', 'ORDER BY', 'LIMIT'],
  'ORDER BY': ['ASC', 'DESC', 'NULLS FIRST', 'NULLS LAST', 'LIMIT'],
  'INSERT INTO': ['VALUES', 'DEFAULT VALUES', 'SELECT'],
  UPDATE: ['SET', 'WHERE'],
  'DELETE FROM': ['WHERE', 'USING'],
  SET: ['WHERE', '=', 'NULL', 'DEFAULT'],
  'CREATE TABLE': ['PRIMARY KEY', 'FOREIGN KEY', 'NOT NULL', 'UNIQUE', 'DEFAULT', 'REFERENCES'],
  'ALTER TABLE': ['ADD COLUMN', 'RENAME COLUMN', 'DROP COLUMN', 'ADD CONSTRAINT', 'DROP CONSTRAINT'],
  START: ['SELECT', 'WITH', 'INSERT INTO', 'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE'],
}

const tableClauses = new Set<Clause>(['FROM', 'JOIN', 'INSERT INTO', 'UPDATE', 'DELETE FROM', 'ALTER TABLE'])
const columnClauses = new Set<Clause>(['SELECT', 'WHERE', 'GROUP BY', 'ORDER BY', 'SET'])
const common = new Set(['SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT JOIN', 'ON', 'OR', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT', 'DISTINCT', 'WITH', 'ILIKE', 'COALESCE', 'NULLIF', 'DATE_TRUNC', 'EXTRACT', 'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM'])
const windowFunctions = new Set(['OVER', 'PARTITION BY', 'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'LAG', 'LEAD'])

function clauseAt(text: string): Clause {
  const matches = [...text.toUpperCase().matchAll(/\b(SELECT|FROM|JOIN|WHERE|GROUP BY|ORDER BY|INSERT INTO|UPDATE|DELETE FROM|SET|CREATE TABLE|ALTER TABLE)\b/g)]
  return (matches.at(-1)?.[0] as Clause | undefined) ?? 'START'
}

function boostFor(completion: Completion, clause: Clause): Completion {
  const label = completion.label.toUpperCase()
  let boost = completion.boost ?? 0
  if (common.has(label)) boost = Math.max(boost, 45)
  if (windowFunctions.has(label)) boost = Math.max(boost, 55)
  if (recommendations[clause].includes(label)) boost = Math.max(boost, 99)
  if (tableClauses.has(clause) && completion.type === 'table') boost = Math.max(boost, 90)
  if (columnClauses.has(clause) && completion.type === 'column') boost = Math.max(boost, 90)
  return { ...completion, boost }
}

export function contextualSqlSource(sources: CompletionSource[]): CompletionSource {
  return async (context: CompletionContext) => {
    const clause = clauseAt(context.state.doc.sliceString(0, context.pos))
    const prefix = context.state.doc.sliceString(0, context.pos).match(/[a-zA-Z_]*$/)?.[0].toUpperCase() ?? ''
    const results = (await Promise.all(sources.map((source) => source(context)))).filter(Boolean) as CompletionResult[]
    if (!results.length) return null
    const options = new Map<string, Completion>()
    for (const result of results) {
      for (const completion of result.options) {
        const boosted = boostFor(completion, clause)
        const previous = options.get(completion.label)
        if (!previous || (boosted.boost ?? 0) > (previous.boost ?? 0)) options.set(completion.label, boosted)
      }
    }
    const phrase = context.state.doc.sliceString(0, context.pos).toUpperCase().match(/\b([A-Z_]+)\s+([A-Z_]*)$/)
    const phrasePrefix = phrase ? `${phrase[1]} ${phrase[2]}` : ''
    const hasMultiwordPrefix = Boolean(phrase && [...options.keys(), ...recommendations[clause]].some((label) => label.includes(' ') && label.startsWith(phrasePrefix)))
    const activePrefix = hasMultiwordPrefix ? phrasePrefix : prefix
    for (const label of recommendations[clause]) {
      if (activePrefix && !label.startsWith(activePrefix)) continue
      const completion = boostFor({ label, type: 'keyword' }, clause)
      const previous = options.get(label)
      if (!previous || (completion.boost ?? 0) > (previous.boost ?? 0)) options.set(label, completion)
    }
    return {
      from: context.pos - activePrefix.length,
      to: context.pos,
      options: [...options.values()],
      filter: true,
    }
  }
}
