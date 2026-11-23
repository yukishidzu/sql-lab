import type { PGliteWorker } from '@electric-sql/pglite/worker'
import PGWorker from './pglite-worker.ts?worker'
import type { DatabaseAdapter, DbRelationship, QueryResult, ScenarioDefinition, SchemaInfo, SqlValue } from '../types'
import { quoteIdentifier } from '../lib/utils'
import { bootstrapScenario } from '../lib/bootstrap'

type RawResult = {
  fields: { name: string; dataTypeID: number }[]
  rows: Record<string, SqlValue>[]
  affectedRows?: number
}

function withDuration(result: RawResult, startedAt: number): QueryResult {
  return {
    fields: result.fields ?? [],
    rows: result.rows ?? [],
    rowCount: result.rows?.length ?? 0,
    affectedRows: result.affectedRows,
    durationMs: performance.now() - startedAt,
  }
}

class PGliteAdapter implements DatabaseAdapter {
  db: PGliteWorker
  scenario: ScenarioDefinition
  workspaceId: string

  constructor(db: PGliteWorker, scenario: ScenarioDefinition, workspaceId: string) {
    this.db = db
    this.scenario = scenario
    this.workspaceId = workspaceId
  }

  async executeOne(sql: string) {
    const startedAt = performance.now()
    const result = await this.db.transaction(async (tx) => {
      await tx.exec("SET LOCAL statement_timeout = '5000ms'")
      return tx.query(sql) as Promise<RawResult>
    })
    return withDuration(result, startedAt)
  }

  async executeScript(sql: string) {
    await this.db.transaction(async (tx) => {
      await tx.exec("SET LOCAL statement_timeout = '15000ms'")
      await tx.exec(sql)
    })
  }

  async introspect(): Promise<SchemaInfo> {
    const [columns, keys, relationships] = await Promise.all([
      this.db.query<{
        table_name: string; column_name: string; data_type: string; is_nullable: string; ordinal_position: number
      }>(`SELECT table_name, column_name, data_type, is_nullable, ordinal_position
         FROM information_schema.columns
         WHERE table_schema = 'public'
         ORDER BY table_name, ordinal_position`),
      this.db.query<{ table_name: string; column_name: string; constraint_type: string }>(`SELECT tc.table_name, kcu.column_name, tc.constraint_type
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
         WHERE tc.table_schema = 'public' AND tc.constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE')`),
      this.db.query<{
        conname: string; source_table: string; target_table: string; source_columns: string[]; target_columns: string[]
      }>(`SELECT c.conname, src.relname AS source_table, tgt.relname AS target_table,
                array_agg(sa.attname ORDER BY k.ord) AS source_columns,
                array_agg(ta.attname ORDER BY k.ord) AS target_columns
         FROM pg_constraint c
         JOIN pg_class src ON src.oid = c.conrelid
         JOIN pg_class tgt ON tgt.oid = c.confrelid
         JOIN pg_namespace ns ON ns.oid = src.relnamespace
         JOIN LATERAL unnest(c.conkey, c.confkey) WITH ORDINALITY AS k(scol, tcol, ord) ON true
         JOIN pg_attribute sa ON sa.attrelid = src.oid AND sa.attnum = k.scol
         JOIN pg_attribute ta ON ta.attrelid = tgt.oid AND ta.attnum = k.tcol
         WHERE c.contype = 'f' AND ns.nspname = 'public'
         GROUP BY c.conname, src.relname, tgt.relname
         ORDER BY c.conname`),
    ])

    const primaryByTable = new Map<string, string[]>()
    const foreign = new Set<string>()
    const uniqueSets: { table: string; columns: string[] }[] = []
    for (const key of keys.rows) {
      if (key.constraint_type === 'PRIMARY KEY') {
        primaryByTable.set(key.table_name, [...(primaryByTable.get(key.table_name) ?? []), key.column_name])
      }
      if (key.constraint_type === 'FOREIGN KEY') foreign.add(`${key.table_name}.${key.column_name}`)
    }
    const constraints = await this.db.query<{ conname: string; table_name: string; contype: string; columns: string[] }>(`SELECT c.conname, rel.relname AS table_name, c.contype,
           array_agg(a.attname ORDER BY k.ord) AS columns
      FROM pg_constraint c
      JOIN pg_class rel ON rel.oid = c.conrelid
      JOIN pg_namespace ns ON ns.oid = rel.relnamespace
      JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(col, ord) ON true
      JOIN pg_attribute a ON a.attrelid = rel.oid AND a.attnum = k.col
      WHERE ns.nspname = 'public' AND c.contype IN ('p', 'u')
      GROUP BY c.conname, rel.relname, c.contype`)
    for (const constraint of constraints.rows) uniqueSets.push({ table: constraint.table_name, columns: constraint.columns })

    const tables = [...new Set(columns.rows.map((column) => column.table_name))].map((name) => ({
      name,
      columns: columns.rows.filter((column) => column.table_name === name).map((column) => ({
        name: column.column_name,
        dataType: column.data_type,
        nullable: column.is_nullable === 'YES',
        primaryKey: primaryByTable.get(name)?.includes(column.column_name) ?? false,
        foreignKey: foreign.has(`${name}.${column.column_name}`),
      })),
    }))

    const result = relationships.rows.map((relation): DbRelationship => {
      const oneToOne = uniqueSets.some((set) => set.table === relation.source_table
        && set.columns.length === relation.source_columns.length
        && set.columns.every((column) => relation.source_columns.includes(column)))
      return {
        id: relation.conname,
        name: relation.conname,
        sourceTable: relation.source_table,
        sourceColumns: relation.source_columns,
        targetTable: relation.target_table,
        targetColumns: relation.target_columns,
        cardinality: oneToOne ? '1:1' : '1:N',
        junction: false,
      }
    })

    for (const table of tables) {
      const outgoing = result.filter((relation) => relation.sourceTable === table.name)
      const foreignColumns = new Set(outgoing.flatMap((relation) => relation.sourceColumns))
      const primaryColumns = primaryByTable.get(table.name) ?? []
      const compositeJunction = outgoing.length === 2 && primaryColumns.length === 2
        && primaryColumns.every((column) => foreignColumns.has(column))
      const uniquePair = uniqueSets.find((set) => set.table === table.name && set.columns.length === 2
        && set.columns.every((column) => foreignColumns.has(column)))
      const pairJunctions = uniquePair ? outgoing.filter((relation) => relation.sourceColumns.length === 1
        && uniquePair.columns.includes(relation.sourceColumns[0])) : []
      if (compositeJunction) outgoing.forEach((relation) => { relation.junction = true })
      else if (pairJunctions.length === 2) pairJunctions.forEach((relation) => { relation.junction = true })
    }
    return { tables, relationships: result }
  }

  async readTable(table: string, limit = 200) {
    const startedAt = performance.now()
    const result = await this.db.query(`SELECT * FROM public.${quoteIdentifier(table)} LIMIT $1`, [limit]) as RawResult
    return withDuration(result, startedAt)
  }

  async insertRow(table: string, row: Record<string, SqlValue>) {
    const columns = Object.keys(row)
    await this.db.query(`INSERT INTO public.${quoteIdentifier(table)} (${columns.map(quoteIdentifier).join(', ')}) VALUES (${columns.map((_, index) => `$${index + 1}`).join(', ')})`, columns.map((column) => row[column]))
  }

  async importRows(table: string, rows: Record<string, SqlValue>[]) {
    await this.db.transaction(async (tx) => {
      for (const row of rows) {
        const columns = Object.keys(row)
        await tx.query(`INSERT INTO public.${quoteIdentifier(table)} (${columns.map(quoteIdentifier).join(', ')}) VALUES (${columns.map((_, index) => `$${index + 1}`).join(', ')})`, columns.map((column) => row[column]))
      }
    })
  }

  async updateRow(table: string, row: Record<string, SqlValue>, original: Record<string, SqlValue>) {
    const schema = await this.introspect()
    const tableInfo = schema.tables.find((item) => item.name === table)
    const primary = tableInfo?.columns.filter((column) => column.primaryKey).map((column) => column.name) ?? []
    if (!primary.length) throw new Error('Для редактирования строки нужен первичный ключ')
    const changed = Object.keys(row).filter((column) => !primary.includes(column))
    if (!changed.length) return
    const where = primary.map((column, index) => `${quoteIdentifier(column)} = $${changed.length + index + 1}`).join(' AND ')
    await this.db.query(`UPDATE public.${quoteIdentifier(table)} SET ${changed.map((column, index) => `${quoteIdentifier(column)} = $${index + 1}`).join(', ')} WHERE ${where}`, [...changed.map((column) => row[column]), ...primary.map((column) => original[column])])
  }

  async deleteRow(table: string, row: Record<string, SqlValue>) {
    const schema = await this.introspect()
    const primary = schema.tables.find((item) => item.name === table)?.columns.filter((column) => column.primaryKey).map((column) => column.name) ?? []
    if (!primary.length) throw new Error('Для удаления строки нужен первичный ключ')
    await this.db.query(`DELETE FROM public.${quoteIdentifier(table)} WHERE ${primary.map((column, index) => `${quoteIdentifier(column)} = $${index + 1}`).join(' AND ')}`, primary.map((column) => row[column]))
  }

  async reset(scenario = this.scenario) {
    this.scenario = scenario
    await this.db.transaction(async (tx) => {
      await tx.exec('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
      await bootstrapScenario(tx, scenario)
    })
    await this.db.syncToFs()
  }

  async dump() {
    const channel = new BroadcastChannel(`sql-lab-tools:sql-lab-${this.workspaceId}`)
    try {
      return await new Promise<string>((resolve, reject) => {
        const requestId = crypto.randomUUID()
        const timeout = setTimeout(() => reject(new Error('Экспорт занял слишком много времени')), 30000)
        channel.onmessage = (event) => {
          if (event.data?.requestId !== requestId) return
          clearTimeout(timeout)
          if (event.data.error) reject(new Error(event.data.error))
          else resolve(event.data.dump)
        }
        channel.postMessage({ type: 'dump', requestId })
      })
    } finally {
      channel.close()
    }
  }


  async restore(dump: string) {
    await this.db.exec('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
    await this.db.exec(dump)
  }

  async close() {
    await this.db.close()
  }
}

export async function openDatabase(workspaceId: string, scenario: ScenarioDefinition, initialized: boolean, initialDump?: string) {
  const { PGliteWorker } = await import('@electric-sql/pglite/worker')
  const worker = new PGWorker({ name: `sql-lab-${workspaceId}` })
  const db = await PGliteWorker.create(worker, {
    id: `sql-lab-${workspaceId}`,
    dataDir: `idb://sql-lab-${workspaceId}`,
  })
  const adapter = new PGliteAdapter(db, scenario, workspaceId)
  if (!initialized) {
    try {
      if (initialDump) await adapter.restore(initialDump)
      else await bootstrapScenario(db, scenario)
      await db.syncToFs()
    } catch (error) {
      await adapter.close()
      throw error
    }
  }
  return adapter
}

export async function validateScenario(scenario: ScenarioDefinition) {
  const { PGlite } = await import('@electric-sql/pglite')
  const db = new PGlite('memory://')
  try {
    await bootstrapScenario(db, scenario)
  } finally {
    await db.close()
  }
}

export async function deleteWorkspaceDatabase(workspaceId: string) {
  const marker = `sql-lab-${workspaceId}`
  const databases = await indexedDB.databases()
  const names = (databases.map((database) => database.name).filter(Boolean) as string[]).filter((name) => name.includes(marker))
  await Promise.all(names.map((name) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('Закройте другие вкладки этой базы и повторите удаление'))
  })))
}
