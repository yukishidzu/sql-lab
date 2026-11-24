import type { DbColumn, DbRelationship, DbTable, SqlValue } from '../types'

type Row = Record<string, SqlValue>

function randomInt(max: number) {
  const values = new Uint32Array(1)
  crypto.getRandomValues(values)
  return values[0] % max
}

function token(length = 8) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length }, () => alphabet[randomInt(alphabet.length)]).join('')
}

function randomTimestamp() {
  const date = new Date(Date.UTC(2026, randomInt(12), 1 + randomInt(28), randomInt(24), randomInt(60), randomInt(60)))
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

function existingText(column: string, rows: Row[]) {
  const values = [...new Set(rows.map((row) => row[column]).filter((value): value is string => typeof value === 'string'))]
  return values.length ? values[randomInt(values.length)] : null
}

function scalarValue(column: DbColumn, table: DbTable, rows: Row[]): SqlValue {
  const name = column.name.toLowerCase()
  const type = column.dataType.toLowerCase()
  if (type === 'boolean') return randomInt(2) === 1
  if (type === 'uuid') return crypto.randomUUID()
  if (type.includes('timestamp')) return randomTimestamp()
  if (type === 'date') return randomTimestamp().slice(0, 10)
  if (type === 'time' || type.startsWith('time ')) return randomTimestamp().slice(11)
  if (type.includes('integer') || type === 'smallint' || type === 'bigint') {
    if (column.primaryKey) {
      const used = new Set(rows.map((row) => String(row[column.name])))
      let value = 1 + randomInt(2_000_000_000)
      while (used.has(String(value))) value = 1 + randomInt(2_000_000_000)
      return value
    }
    return 1 + randomInt(1000)
  }
  if (['numeric', 'decimal', 'real', 'double precision'].some((item) => type.includes(item))) return `${1 + randomInt(10000)}.${String(randomInt(100)).padStart(2, '0')}`
  if (type === 'json' || type === 'jsonb') return '{}'
  if (type === 'bytea') return `\\x${token(8)}`

  if (column.primaryKey) return `${table.name.slice(0, 3).toUpperCase()}-${token(10)}`
  if (name.includes('email')) return `user-${token(10).toLowerCase()}@example.com`
  if (name.includes('phone')) return `+7900${String(randomInt(10_000_000)).padStart(7, '0')}`
  if (name === 'book_ref' || name.endsWith('_ref')) return `BK-${token(8)}`
  if (name === 'name' || name.endsWith('_name')) return `Тест ${token(6)}`
  if (name.includes('status') || name.includes('condition') || name === 'role' || name === 'city' || name === 'cuisine' || name === 'timezone') {
    const sample = existingText(column.name, rows)
    if (sample) return sample
  }
  return `${name || 'value'}_${token(8)}`
}

function normalizeChronology(row: Row, startColumn: string, endColumn: string) {
  const start = row[startColumn]
  const end = row[endColumn]
  if (typeof start !== 'string' || typeof end !== 'string') return
  const startTime = new Date(`${start.replace(' ', 'T')}Z`)
  const endTime = new Date(`${end.replace(' ', 'T')}Z`)
  if (endTime.getTime() > startTime.getTime()) return
  startTime.setUTCMinutes(startTime.getUTCMinutes() + 90)
  row[endColumn] = startTime.toISOString().slice(0, 19).replace('T', ' ')
}

export async function generateValidRow(
  table: DbTable,
  relationships: DbRelationship[],
  existingRows: Row[],
  readTable: (table: string) => Promise<Row[]>,
): Promise<Row> {
  const outgoing = relationships.filter((relation) => relation.sourceTable === table.name)
  const primary = table.columns.filter((column) => column.primaryKey).map((column) => column.name)
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const row: Row = {}
    for (const relation of outgoing) {
      const referencedRows = await readTable(relation.targetTable)
      if (!referencedRows.length) throw new Error(`Сначала добавьте строки в ${relation.targetTable}`)
      const referenced = referencedRows[randomInt(referencedRows.length)]
      relation.sourceColumns.forEach((column, index) => { row[column] = referenced[relation.targetColumns[index]] })
    }
    for (const column of table.columns) {
      if (row[column.name] === undefined) row[column.name] = scalarValue(column, table, existingRows)
    }
    normalizeChronology(row, 'scheduled_departure', 'scheduled_arrival')
    normalizeChronology(row, 'actual_departure', 'actual_arrival')
    const uniqueGroups = [...(primary.length ? [primary] : []), ...(table.uniqueGroups ?? [])]
    const duplicate = uniqueGroups.some((group) => existingRows.some((existing) => group.every((column) => existing[column] === row[column])))
    if (!duplicate) return row
  }
  throw new Error('Не удалось найти уникальную комбинацию первичного ключа')
}
