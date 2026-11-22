import Dexie, { type Table } from 'dexie'
import type { QueryRun, SavedQuery, Workspace } from '../types'

class SqlLabDatabase extends Dexie {
  workspaces!: Table<Workspace, string>
  queries!: Table<SavedQuery, string>
  runs!: Table<QueryRun, string>
  settings!: Table<{ key: string; value: unknown }, string>

  constructor() {
    super('sql-lab-app')
    this.version(1).stores({
      workspaces: 'id, name, updatedAt, createdAt',
      queries: 'id, workspaceId, name, updatedAt',
      runs: 'id, workspaceId, createdAt',
      settings: 'key',
    })
  }
}

export const store = new SqlLabDatabase()

export async function createWorkspaceRecord(scenario: Workspace['scenario']) {
  const now = Date.now()
  const workspace: Workspace = {
    id: crypto.randomUUID(),
    name: scenario.name,
    draft: scenario.starterQueries[0]?.sql ?? 'SELECT 1 AS ready;',
    notes: scenario.notes,
    scenario: structuredClone(scenario),
    initialized: false,
    createdAt: now,
    updatedAt: now,
  }
  await store.workspaces.add(workspace)
  return workspace
}

export async function touchWorkspace(id: string, patch: Partial<Workspace>) {
  await store.workspaces.update(id, { ...patch, updatedAt: Date.now() })
}

export async function saveNamedQuery(workspaceId: string, name: string, sql: string, starter = false) {
  const now = Date.now()
  const query: SavedQuery = { id: crypto.randomUUID(), workspaceId, name, sql, starter, createdAt: now, updatedAt: now }
  await store.queries.add(query)
  return query
}

export async function recordRun(run: Omit<QueryRun, 'id' | 'createdAt'>) {
  const entry: QueryRun = { ...run, id: crypto.randomUUID(), createdAt: Date.now() }
  await store.runs.add(entry)
  const oldRuns = await store.runs.where('workspaceId').equals(run.workspaceId).reverse().sortBy('createdAt')
  const excess = oldRuns.slice(200)
  await Promise.all(excess.map((old) => store.runs.delete(old.id)))
  return entry
}
