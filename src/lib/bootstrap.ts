import type { PGlite } from '@electric-sql/pglite'
import type { ScenarioDefinition } from '../types'
import { quoteIdentifier } from './utils'

type DatabaseConnection = Pick<PGlite, 'exec' | 'query'>
type TransactionConnection = DatabaseConnection & Pick<PGlite, 'transaction'>

export type BootstrapProgress = {
  stage: 'schema' | 'data' | 'sequences'
  completed: number
  total: number
}

export async function insertScenarioData(db: DatabaseConnection, scenario: ScenarioDefinition, onProgress?: (progress: BootstrapProgress) => void) {
  const tables = Object.entries(scenario.data)
  for (const [tableIndex, [table, rows]] of tables.entries()) {
    const groups = new Map<string, typeof rows>()
    for (const row of rows) {
      const signature = Object.keys(row).join('\0')
      groups.set(signature, [...(groups.get(signature) ?? []), row])
    }
    for (const group of groups.values()) {
      for (let offset = 0; offset < group.length; offset += 100) {
        const chunk = group.slice(offset, offset + 100)
        const columns = Object.keys(chunk[0])
        if (!columns.length) continue
        const values = chunk.map((_, rowIndex) => `(${columns.map((_, columnIndex) => `$${rowIndex * columns.length + columnIndex + 1}`).join(', ')})`).join(', ')
        const sql = `INSERT INTO public.${quoteIdentifier(table)} (${columns.map(quoteIdentifier).join(', ')}) VALUES ${values}`
        await db.query(sql, chunk.flatMap((row) => columns.map((column) => row[column])))
      }
    }
    onProgress?.({ stage: 'data', completed: tableIndex + 1, total: tables.length })
  }
}

export async function syncIdentitySequences(db: DatabaseConnection) {
  const result = await db.query<{ table_name: string }>(`SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND is_identity = 'YES'
    ORDER BY table_name`)
  for (const { table_name: table } of result.rows) {
    const literal = table.replaceAll("'", "''")
    await db.query(`SELECT setval(pg_get_serial_sequence('${literal}', 'id'), COALESCE((SELECT MAX(id) FROM public.${quoteIdentifier(table)}), 1), (SELECT COUNT(*) > 0 FROM public.${quoteIdentifier(table)}))`)
  }
}

export async function bootstrapScenarioContents(db: DatabaseConnection, scenario: ScenarioDefinition, onProgress?: (progress: BootstrapProgress) => void) {
  onProgress?.({ stage: 'schema', completed: 0, total: 1 })
  await db.exec(scenario.schemaSql)
  onProgress?.({ stage: 'schema', completed: 1, total: 1 })
  await insertScenarioData(db, scenario, onProgress)
  await syncIdentitySequences(db)
  onProgress?.({ stage: 'sequences', completed: 1, total: 1 })
}

export async function bootstrapScenario(db: TransactionConnection, scenario: ScenarioDefinition, onProgress?: (progress: BootstrapProgress) => void) {
  await db.transaction((tx) => bootstrapScenarioContents(tx, scenario, onProgress))
}
