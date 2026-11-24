import type { DatabaseAdapter, QueryResult, SqlTask, SqlValue } from '../types'

export type TaskCheckResult = {
  status: 'passed' | 'failed' | 'error'
  message: string
}

export const defaultTaskRules: SqlTask['rules'] = {
  compareColumns: false,
  compareOrder: false,
  readOnly: true,
}

export function defineTasks(definitions: [title: string, prompt: string][], referenceQueries: string[], orderedTasks: number[] = []): SqlTask[] {
  return definitions.map(([title, prompt], index) => ({
    id: `task-${index + 1}`,
    title,
    prompt,
    referenceQuery: referenceQueries[index] ?? '',
    rules: { ...defaultTaskRules, compareOrder: orderedTasks.includes(index + 1) },
  }))
}

export function tasksFromNotes(notes: string, referenceQueries: string[]): SqlTask[] {
  const matches = [...notes.matchAll(/^###\s+(\d+)\.\s+(.+)$/gm)]
  return matches.map((match, index) => ({
    id: `task-${match[1]}`,
    title: match[2].trim(),
    prompt: notes.slice((match.index ?? 0) + match[0].length, matches[index + 1]?.index ?? notes.length).trim(),
    referenceQuery: referenceQueries[index] ?? '',
    rules: { ...defaultTaskRules },
  }))
}

const numericTypes = new Set([20, 21, 23, 26, 700, 701, 1700])

function normalizedValue(value: SqlValue, dataType: number): unknown {
  if (numericTypes.has(dataType) && value !== null) {
    const number = Number(value)
    if (Number.isFinite(number) && Math.abs(number) <= Number.MAX_SAFE_INTEGER) return number
  }
  if (typeof value === 'bigint') return value.toString()
  if (value && typeof value === 'object') return JSON.stringify(value)
  return value
}

function canonicalRows(result: QueryResult) {
  const values = result.rowValues ?? result.rows.map((row) => result.fields.map((field) => row[field.name]))
  return values.map((row) => JSON.stringify(row.map((value, index) => normalizedValue(value, result.fields[index]?.dataTypeID))))
}

export function compareTaskResults(actual: QueryResult, expected: QueryResult, rules: SqlTask['rules']): TaskCheckResult {
  if (rules.compareColumns) {
    const actualColumns = actual.fields.map((field) => field.name)
    const expectedColumns = expected.fields.map((field) => field.name)
    if (JSON.stringify(actualColumns) !== JSON.stringify(expectedColumns)) {
      return { status: 'failed', message: `Колонки не совпадают. Ожидалось: ${expectedColumns.join(', ') || 'нет'}; получено: ${actualColumns.join(', ') || 'нет'}.` }
    }
  }
  if (actual.fields.length !== expected.fields.length) {
    return { status: 'failed', message: `Количество колонок не совпадает: ожидалось ${expected.fields.length}, получено ${actual.fields.length}.` }
  }
  const actualRows = canonicalRows(actual)
  const expectedRows = canonicalRows(expected)
  if (actualRows.length !== expectedRows.length) {
    return { status: 'failed', message: `Количество строк не совпадает: ожидалось ${expectedRows.length}, получено ${actualRows.length}.` }
  }
  if (!rules.compareOrder) {
    actualRows.sort()
    expectedRows.sort()
  }
  const mismatch = actualRows.findIndex((row, index) => row !== expectedRows[index])
  if (mismatch >= 0) {
    const expectedRow = expectedRows[mismatch].slice(0, 220)
    const actualRow = actualRows[mismatch].slice(0, 220)
    return { status: 'failed', message: `Данные не совпадают${rules.compareOrder ? ` в строке ${mismatch + 1}` : ''}. Ожидалось ${expectedRow}; получено ${actualRow}.` }
  }
  return { status: 'passed', message: `Задание принято: ${actualRows.length} ${actualRows.length === 1 ? 'строка' : 'строк'} совпадают с эталоном.` }
}

export async function checkTask(adapter: DatabaseAdapter, task: SqlTask, sql: string): Promise<TaskCheckResult> {
  if (!sql.trim()) return { status: 'failed', message: 'Напишите SQL-запрос перед проверкой.' }
  if (!task.referenceQuery.trim()) return { status: 'error', message: 'В задании не задан эталонный запрос.' }
  if (task.rules.readOnly && !/^\s*(SELECT|WITH)\b/i.test(sql)) {
    return { status: 'failed', message: 'По правилам задания разрешены только запросы SELECT и WITH.' }
  }
  try {
    const expected = await adapter.executeOne(task.referenceQuery)
    const actual = task.rules.readOnly ? await adapter.executeReadOnly(sql) : await adapter.executeOne(sql)
    return compareTaskResults(actual, expected, task.rules)
  } catch (reason) {
    return { status: 'error', message: reason instanceof Error ? reason.message : String(reason) }
  }
}
