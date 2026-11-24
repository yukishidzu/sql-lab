export type SqlValue = string | number | bigint | boolean | null | object

export type QueryField = {
  name: string
  dataTypeID: number
}

export type QueryResult = {
  fields: QueryField[]
  rows: Record<string, SqlValue>[]
  rowValues?: SqlValue[][]
  rowCount: number
  affectedRows?: number
  durationMs: number
}

export type DbColumn = {
  name: string
  dataType: string
  nullable: boolean
  primaryKey: boolean
  foreignKey: boolean
}

export type DbTable = {
  name: string
  columns: DbColumn[]
  uniqueGroups?: string[][]
}

export type DbRelationship = {
  id: string
  name: string
  sourceTable: string
  sourceColumns: string[]
  targetTable: string
  targetColumns: string[]
  cardinality: '1:1' | '1:N'
  junction: boolean
}

export type SchemaInfo = {
  tables: DbTable[]
  relationships: DbRelationship[]
}

export type SavedQuery = {
  id: string
  workspaceId: string
  name: string
  sql: string
  starter: boolean
  createdAt: number
  updatedAt: number
}

export type QueryRun = {
  id: string
  workspaceId: string
  sql: string
  status: 'success' | 'error'
  durationMs: number
  rowCount: number
  error?: string
  createdAt: number
}

export type ScenarioData = Record<string, Record<string, SqlValue>[]>

export type SqlTask = {
  id: string
  title: string
  prompt: string
  referenceQuery: string
  rules: {
    compareColumns: boolean
    compareOrder: boolean
    readOnly: boolean
  }
}

export type WorkspaceMode = 'learn' | 'edit'

export type ScenarioDefinition = {
  formatVersion: 1
  mode?: WorkspaceMode
  name: string
  description: string
  basePreset: { id: string; version: number } | null
  schemaSql: string
  data: ScenarioData
  notes: string
  tasks?: SqlTask[]
  starterQueries: { name: string; sql: string }[]
  layout: Record<string, { x: number; y: number }>
}

export type Workspace = {
  id: string
  name: string
  draft: string
  notes: string
  scenario: ScenarioDefinition
  initialized: boolean
  initialDump?: string
  createdAt: number
  updatedAt: number
}

export type Preset = {
  id: string
  version: number
  name: string
  description: string
  difficulty: 'Базовый' | 'Средний' | 'Продвинутый'
  accent: string
  scenario: ScenarioDefinition
}

export type DatabaseAdapter = {
  executeOne(sql: string): Promise<QueryResult>
  executeReadOnly(sql: string): Promise<QueryResult>
  executeScript(sql: string): Promise<void>
  introspect(): Promise<SchemaInfo>
  readTable(table: string, limit?: number | null): Promise<QueryResult>
  insertRow(table: string, row: Record<string, SqlValue>): Promise<void>
  importRows(table: string, rows: Record<string, SqlValue>[]): Promise<void>
  updateRow(table: string, row: Record<string, SqlValue>, original: Record<string, SqlValue>): Promise<void>
  deleteRow(table: string, row: Record<string, SqlValue>): Promise<void>
  reset(scenario?: ScenarioDefinition): Promise<void>
  dump(): Promise<string>
  restore(dump: string): Promise<void>
  close(): Promise<void>
}
