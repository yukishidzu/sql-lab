import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, RefreshCw, Trash2, Upload } from 'lucide-react'
import type { DatabaseAdapter, DbTable, QueryResult, SqlValue } from '../types'
import { displayValue } from '../lib/utils'
import { parseDataImport } from '../lib/csv'
import { Button } from './ui/button'
import { Dialog, DialogContent } from './ui/dialog'
import { Input } from './ui/input'

function inputValue(value: SqlValue | undefined) {
  return value === null || value === undefined ? '' : displayValue(value)
}

function typedValue(value: string, isNull: boolean, type: string): SqlValue {
  if (isNull) return null
  if (type === 'bigint') return value === '' ? null : value
  if (type.includes('integer') || type === 'smallint') return value === '' ? null : Number(value)
  if (type === 'boolean') return value.toLowerCase() === 'true' || value === 't' || value === '1'
  return value
}

export function DataDrawer({ tableName, table, adapter, open, onOpenChange, onChanged }: {
  tableName: string | null
  table?: DbTable
  adapter: DatabaseAdapter | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onChanged: () => void
}) {
  const [result, setResult] = useState<QueryResult | null>(null)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Record<string, SqlValue> | null>(null)
  const [original, setOriginal] = useState<Record<string, SqlValue> | null>(null)
  const [nulls, setNulls] = useState<Record<string, boolean>>({})
  const [error, setError] = useState('')
  const [importPreview, setImportPreview] = useState<Record<string, SqlValue>[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    if (!adapter || !tableName) return
    try { setResult(await adapter.readTable(tableName)); setError('') } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
  }, [adapter, tableName])
  useEffect(() => { if (open) void load(); else { setResult(null); setEditing(null); setImportPreview([]) } }, [open, load])

  const startEdit = (row: Record<string, SqlValue> | null) => {
    setOriginal(row)
    setEditing(row ? { ...row } : Object.fromEntries(table?.columns.map((column) => [column.name, '']) ?? []))
    setNulls(Object.fromEntries(table?.columns.map((column) => [column.name, row?.[column.name] === null]) ?? []))
  }
  const save = async () => {
    if (!adapter || !tableName || !editing || !table) return
    try {
      const row = Object.fromEntries(table.columns.map((column) => [column.name, typedValue(inputValue(editing[column.name]), nulls[column.name], column.dataType)]))
      if (original) await adapter.updateRow(tableName, row, original)
      else await adapter.insertRow(tableName, row)
      setEditing(null); await load(); onChanged()
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
  }
  const importRows = async () => {
    if (!adapter || !tableName) return
    try {
      await adapter.importRows(tableName, importPreview)
      setImportPreview([]); await load(); onChanged()
    } catch (reason) { setError(reason instanceof Error ? `${reason.message} Пакет не импортирован.` : String(reason)) }
  }

  const rows = result?.rows.filter((row) => !search || displayValue(Object.values(row)).toLowerCase().includes(search.toLowerCase())) ?? []
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={tableName ? `Данные: ${tableName}` : 'Данные'} description="Просмотр и редактирование живой базы PostgreSQL" className="flex h-[82vh] max-w-6xl flex-col">
        {error && <div role="alert" className="mb-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">{error}</div>}
        {editing ? <div className="min-h-0 flex-1 overflow-auto"><div className="grid gap-3 md:grid-cols-2">{table?.columns.map((column) => <label key={column.name} className="text-xs font-medium">{column.name}<span className="ml-1 font-normal text-muted-foreground">{column.dataType}{column.primaryKey ? ' · PK' : ''}</span><div className="mt-1 flex gap-2"><Input value={inputValue(editing[column.name])} disabled={nulls[column.name] || (original !== null && column.primaryKey)} onChange={(event) => setEditing({ ...editing, [column.name]: event.target.value })} /><label className="flex items-center gap-1 text-[11px] font-normal"><input type="checkbox" disabled={original !== null && column.primaryKey} checked={nulls[column.name] ?? false} onChange={(event) => setNulls({ ...nulls, [column.name]: event.target.checked })} />NULL</label></div></label>)}</div><div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={() => setEditing(null)}>Отмена</Button><Button onClick={() => void save()}>Сохранить строку</Button></div></div> : <>
          <div className="mb-3 flex flex-wrap gap-2"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск по текущим строкам" className="max-w-xs" /><Button variant="outline" size="sm" onClick={() => startEdit(null)}><Plus size={14} />Строка</Button><Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload size={14} />CSV / JSON</Button><input ref={fileRef} type="file" accept=".csv,.json" className="hidden" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { const rows = parseDataImport(await file.text(), file.name.split('.').pop()?.toLowerCase() ?? 'csv'); setImportPreview(rows.slice(0, 500)); setError(rows.length > 500 ? 'Импорт ограничен первыми 500 строками' : '') } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) } event.target.value = '' }} /><Button variant="ghost" size="icon" className="ml-auto" onClick={() => void load()} aria-label="Обновить"><RefreshCw size={15} /></Button></div>
          {importPreview.length > 0 && <div className="mb-3 flex items-center gap-3 rounded-lg bg-secondary p-3 text-xs"><span>Готово к импорту: {importPreview.length} строк</span><Button size="sm" onClick={() => void importRows()}>Импортировать</Button><Button variant="ghost" size="sm" onClick={() => setImportPreview([])}>Отмена</Button></div>}
          <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border"><table className="w-full border-collapse font-mono text-xs"><thead className="sticky top-0 bg-secondary"><tr>{table?.columns.map((column) => <th key={column.name} className="px-3 py-2 text-left">{column.name}</th>)}<th className="w-16" /></tr></thead><tbody>{rows.map((row, index) => <tr key={index} className="border-t border-border/60"><>{table?.columns.map((column) => <td key={column.name} className="max-w-48 truncate px-3 py-2" title={displayValue(row[column.name])}><button className="cursor-pointer text-left" onClick={() => startEdit(row)}>{displayValue(row[column.name])}</button></td>)}</><td><Button variant="ghost" size="icon" className="size-7" aria-label="Удалить строку" onClick={async () => { if (!adapter || !tableName || !confirm('Удалить эту строку?')) return; try { await adapter.deleteRow(tableName, row); await load(); onChanged() } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) } }}><Trash2 size={13} /></Button></td></tr>)}</tbody></table>{!rows.length && <div className="p-8 text-center text-sm text-muted-foreground">Строк не найдено</div>}</div>
        </>}
      </DialogContent>
    </Dialog>
  )
}
