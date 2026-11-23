import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { SchemaInfo } from '../types'
import { buildCreateTableSql, POSTGRES_TYPES, type TableColumnDraft } from '../lib/table-sql'
import { Dialog, DialogContent } from './ui/dialog'
import { Button } from './ui/button'
import { Input, Textarea } from './ui/input'

type DraftColumn = TableColumnDraft & { id: string }

const selectClass = 'h-9 rounded-lg border border-input bg-background px-2 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/15'

function newColumn(name = '', type = 'text'): DraftColumn {
  return {
    id: crypto.randomUUID(), name, type, primary: false, unique: false, notNull: false,
    defaultValue: '', refTable: '', refColumn: '', composite: false, onDelete: '',
  }
}

function normalizeType(type: string) {
  if (type === 'character varying') return 'character varying(255)'
  if (type === 'numeric' || type === 'decimal') return 'numeric(10, 2)'
  return POSTGRES_TYPES.some((item) => item.value === type) ? type : 'text'
}

export function TableBuilder({ open, onOpenChange, schema, onAdd }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  schema: SchemaInfo
  onAdd: (sql: string) => void
}) {
  const [tableName, setTableName] = useState('')
  const [columns, setColumns] = useState<DraftColumn[]>([
    { ...newColumn('id', 'integer'), primary: true },
    newColumn('name'),
  ])
  const [error, setError] = useState('')
  const update = (id: string, patch: Partial<DraftColumn>) => setColumns((current) => current.map((column) => column.id === id ? { ...column, ...patch } : column))
  const targetColumns = (column: DraftColumn) => {
    if (column.refTable === tableName && tableName) return columns.filter((item) => item.name).map((item) => ({ name: item.name, dataType: item.type }))
    return schema.tables.find((table) => table.name === column.refTable)?.columns ?? []
  }
  const preview = useMemo(() => {
    try { return buildCreateTableSql(tableName, columns) } catch { return '-- Заполните название таблицы и колонки' }
  }, [tableName, columns])
  const submit = () => {
    try { onAdd(buildCreateTableSql(tableName, columns)) } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Новая таблица" description="Настройте колонки и связи. Обычные колонки допускают NULL по умолчанию; PK всегда NOT NULL." className="flex h-[88vh] max-w-6xl flex-col">
        {error && <div role="alert" className="mb-3 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">{error}</div>}
        <label className="mb-4 block text-xs font-medium">Имя таблицы<Input className="mt-1 max-w-sm" value={tableName} placeholder="products" onChange={(event) => {
          const next = event.target.value
          setColumns((current) => current.map((column) => column.refTable && column.refTable === tableName ? { ...column, refTable: next } : column))
          setTableName(next)
        }} /></label>
        <div className="min-h-0 flex-1 space-y-3 overflow-auto pr-1">
          {columns.map((column, index) => <section key={column.id} className="rounded-xl border border-border bg-secondary/25 p-3" aria-label={`Колонка ${index + 1}`}>
            <div className="grid gap-2 lg:grid-cols-[1fr_230px_auto]">
              <label className="text-[11px] text-muted-foreground">Название<Input value={column.name} placeholder="column_name" aria-label={`Имя колонки ${index + 1}`} className="mt-1 font-mono" onChange={(event) => update(column.id, { name: event.target.value })} /></label>
              <label className="text-[11px] text-muted-foreground">Тип PostgreSQL<select aria-label={`Тип колонки ${index + 1}`} className={`${selectClass} mt-1 w-full`} value={column.type} onChange={(event) => update(column.id, { type: event.target.value })}>{POSTGRES_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
              <div className="flex items-end gap-3 pb-1 text-[11px]">
                <label className="flex items-center gap-1"><input type="checkbox" checked={column.primary} onChange={(event) => update(column.id, { primary: event.target.checked })} />PK</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={column.unique} onChange={(event) => update(column.id, { unique: event.target.checked })} />UNIQUE</label>
                <label className="flex items-center gap-1" title="PK автоматически NOT NULL"><input type="checkbox" checked={column.primary || column.notNull} disabled={column.primary} onChange={(event) => update(column.id, { notNull: event.target.checked })} />NOT NULL</label>
                <Button variant="ghost" size="icon" className="size-8" disabled={columns.length === 1} onClick={() => setColumns((current) => current.filter((item) => item.id !== column.id))} aria-label={`Удалить колонку ${index + 1}`}><Trash2 size={14} /></Button>
              </div>
            </div>
            <div className="mt-3 grid gap-2 border-t border-border/70 pt-3 lg:grid-cols-[1fr_1fr_1fr]">
              <label className="text-[11px] text-muted-foreground">DEFAULT — необязательно<Input value={column.defaultValue} aria-label={`Значение по умолчанию ${index + 1}`} placeholder="true, 0 или now()" className="mt-1 font-mono text-xs" onChange={(event) => update(column.id, { defaultValue: event.target.value })} /></label>
              <label className="text-[11px] text-muted-foreground">FK — родительская таблица<select aria-label={`Таблица FK ${index + 1}`} className={`${selectClass} mt-1 w-full`} value={column.refTable} onChange={(event) => update(column.id, { refTable: event.target.value, refColumn: '', composite: false })}><option value="">Без внешнего ключа</option>{tableName && <option value={tableName}>{tableName} — эта таблица</option>}{schema.tables.map((table) => <option key={table.name} value={table.name}>{table.name}</option>)}</select></label>
              {column.refTable && <label className="text-[11px] text-muted-foreground">Родительская колонка<select aria-label={`Колонка FK ${index + 1}`} className={`${selectClass} mt-1 w-full`} value={column.refColumn} onChange={(event) => {
                const target = targetColumns(column).find((item) => item.name === event.target.value)
                update(column.id, { refColumn: event.target.value, type: target ? normalizeType(target.dataType) : column.type })
              }}><option value="">Выберите колонку</option>{targetColumns(column).map((target) => <option key={target.name} value={target.name}>{target.name} · {target.dataType}</option>)}</select></label>}
            </div>
            {column.refTable && <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground"><label className="flex items-center gap-1" title="Две и более колонки с одинаковой родительской таблицей образуют один составной FK"><input type="checkbox" checked={column.composite} onChange={(event) => update(column.id, { composite: event.target.checked })} />Составной FK</label><label className="flex items-center gap-2">ON DELETE<select aria-label={`ON DELETE ${index + 1}`} className={selectClass} value={column.onDelete} onChange={(event) => update(column.id, { onDelete: event.target.value as DraftColumn['onDelete'] })}><option value="">NO ACTION</option><option value="CASCADE">CASCADE</option><option value="RESTRICT">RESTRICT</option><option value="SET NULL">SET NULL</option></select></label></div>}
          </section>)}
        </div>
        <Button variant="outline" size="sm" className="mt-3 shrink-0 self-start" onClick={() => setColumns((current) => [...current, newColumn()])}><Plus size={14} />Добавить колонку</Button>
        <div className="mt-4 shrink-0"><div className="mb-1 text-[11px] font-medium text-muted-foreground">Предпросмотр DDL</div><Textarea readOnly value={preview} className="h-36 resize-none font-mono text-[11px] leading-relaxed" aria-label="DDL новой таблицы" /></div>
        <div className="mt-4 flex shrink-0 justify-end gap-2"><Button variant="ghost" onClick={() => onOpenChange(false)}>Отмена</Button><Button onClick={submit}>Добавить в DDL</Button></div>
      </DialogContent>
    </Dialog>
  )
}
