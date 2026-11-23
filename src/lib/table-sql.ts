import { quoteIdentifier } from './utils'

export const POSTGRES_TYPES = [
  { value: 'integer', label: 'integer — целое число' },
  { value: 'bigint', label: 'bigint — большое целое' },
  { value: 'text', label: 'text — текст' },
  { value: 'character varying(255)', label: 'varchar(255) — строка' },
  { value: 'numeric(10, 2)', label: 'numeric(10,2) — число с точностью' },
  { value: 'boolean', label: 'boolean — да / нет' },
  { value: 'date', label: 'date — дата' },
  { value: 'time without time zone', label: 'time — время' },
  { value: 'timestamp without time zone', label: 'timestamp — дата и время' },
  { value: 'timestamp with time zone', label: 'timestamptz — дата, время и зона' },
  { value: 'uuid', label: 'uuid — идентификатор' },
  { value: 'jsonb', label: 'jsonb — JSON' },
] as const

export type TableColumnDraft = {
  name: string
  type: string
  primary: boolean
  unique: boolean
  notNull: boolean
  defaultValue: string
  refTable: string
  refColumn: string
  composite: boolean
  onDelete: '' | 'CASCADE' | 'RESTRICT' | 'SET NULL'
}

function validateIdentifier(value: string, label: string) {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) throw new Error(`${label}: используйте строчные латинские буквы, цифры и _`)
}

export function buildCreateTableSql(tableName: string, columns: TableColumnDraft[]) {
  validateIdentifier(tableName, 'Некорректное имя таблицы')
  if (!columns.length) throw new Error('Добавьте хотя бы одну колонку')
  const names = new Set<string>()
  for (const column of columns) {
    validateIdentifier(column.name, 'Некорректное имя колонки')
    if (names.has(column.name)) throw new Error(`Колонка ${column.name} встречается несколько раз`)
    names.add(column.name)
    if (!POSTGRES_TYPES.some((type) => type.value === column.type)) throw new Error(`Неподдерживаемый тип: ${column.type}`)
    if (Boolean(column.refTable) !== Boolean(column.refColumn)) throw new Error(`Выберите таблицу и колонку FK для ${column.name}`)
    if (column.onDelete === 'SET NULL' && (column.notNull || column.primary)) throw new Error(`ON DELETE SET NULL несовместимо с NOT NULL у ${column.name}`)
    if (column.refTable) {
      validateIdentifier(column.refTable, 'Некорректная таблица FK')
      validateIdentifier(column.refColumn, 'Некорректная колонка FK')
    }
  }

  const lines = columns.map((column) => {
    const parts = [`  ${quoteIdentifier(column.name)}`, column.type]
    if (column.notNull || column.primary) parts.push('NOT NULL')
    if (column.unique) parts.push('UNIQUE')
    if (column.defaultValue.trim()) parts.push(`DEFAULT ${column.defaultValue.trim()}`)
    return parts.join(' ')
  })
  const primary = columns.filter((column) => column.primary)
  if (primary.length) lines.push(`  PRIMARY KEY (${primary.map((column) => quoteIdentifier(column.name)).join(', ')})`)

  const compositeGroups = new Map<string, TableColumnDraft[]>()
  for (const column of columns.filter((item) => item.refTable)) {
    if (!column.composite) {
      lines.push(`  CONSTRAINT ${quoteIdentifier(`fk_${tableName}_${column.name}`)} FOREIGN KEY (${quoteIdentifier(column.name)}) REFERENCES ${quoteIdentifier(column.refTable)} (${quoteIdentifier(column.refColumn)})${column.onDelete ? ` ON DELETE ${column.onDelete}` : ''}`)
      continue
    }
    const key = `${column.refTable}|${column.onDelete}`
    compositeGroups.set(key, [...(compositeGroups.get(key) ?? []), column])
  }
  for (const group of compositeGroups.values()) {
    if (group.length < 2) throw new Error('Составной FK должен объединять минимум две колонки с одинаковым действием ON DELETE')
    const first = group[0]
    lines.push(`  CONSTRAINT ${quoteIdentifier(`fk_${tableName}_${group.map((column) => column.name).join('_')}`)} FOREIGN KEY (${group.map((column) => quoteIdentifier(column.name)).join(', ')}) REFERENCES ${quoteIdentifier(first.refTable)} (${group.map((column) => quoteIdentifier(column.refColumn)).join(', ')})${first.onDelete ? ` ON DELETE ${first.onDelete}` : ''}`)
  }
  return `CREATE TABLE ${quoteIdentifier(tableName)} (\n${lines.join(',\n')}\n);`
}
