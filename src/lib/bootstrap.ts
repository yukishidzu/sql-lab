import type { PGlite } from '@electric-sql/pglite'
import type { ScenarioDefinition } from '../types'
import { quoteIdentifier } from './utils'

type DatabaseConnection = Pick<PGlite, 'exec' | 'query'>

export async function insertScenarioData(db: DatabaseConnection, scenario: ScenarioDefinition) {
  for (const [table, rows] of Object.entries(scenario.data)) {
    for (const row of rows) {
      const columns = Object.keys(row)
      if (!columns.length) continue
      const sql = `INSERT INTO public.${quoteIdentifier(table)} (${columns.map(quoteIdentifier).join(', ')}) VALUES (${columns.map((_, index) => `$${index + 1}`).join(', ')})`
      await db.query(sql, columns.map((column) => row[column]))
    }
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

export async function bootstrapScenario(db: DatabaseConnection, scenario: ScenarioDefinition) {
  await db.exec(scenario.schemaSql)
  await insertScenarioData(db, scenario)
  await syncIdentitySequences(db)
}
