import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, RefreshCw, Trash2, Upload, WandSparkles } from 'lucide-react'
import type { DatabaseAdapter, DbTable, QueryResult, SchemaInfo, SqlValue } from '../types'
import { displayValue } from '../lib/utils'
import { parseDataImport } from '../lib/csv'
import { generateValidRow } from '../lib/generate'
import { Button } from './ui/button'
import { Dialog, DialogContent } from './ui/dialog'
import { Input } from './ui/input'

type Row = Record<string, SqlValue>
type RowDraft = { editing: Row; original: Row | null; nulls: Record<string, boolean> }

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

function serializeDraft(draft: RowDraft) {
  return JSON.stringify(draft, (_, value: unknown) => typeof value === 'bigint' ? value.toString() : value)
}

export function DataDrawer({ workspaceId, tableName, table, schema, adapter, open, onOpenChange, onChanged }: {
  workspaceId: string
  tableName: string | null
  table?: DbTable
  schema: SchemaInfo
  adapter: DatabaseAdapter | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onChanged: () => void
}) {
  const [result, setResult] = useState<QueryResult | null>(null)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Row | null>(null)
  const [original, setOriginal] = useState<Row | null>(null)
  const [nulls, setNulls] = useState<Record<string, boolean>>({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [generating, setGenerating] = useState(false)
  const [importPreview, setImportPreview] = useState<Row[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const draftKey = tableName ? `sql-lab-row-draft:${workspaceId}:${tableName}` : ''

  const clearDraft = useCallback(() => {
    if (draftKey) localStorage.removeItem(draftKey)
  }, [draftKey])
  const load = useCallback(async () => {
    if (!adapter || !tableName) return
    try { setResult(await adapter.readTable(tableName)); setError('') } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
  }, [adapter, tableName])

  useEffect(() => {
    if (!open) { setResult(null); setEditing(null); setImportPreview([]); setNotice(''); return }
    void load().then(() => {
      if (!draftKey) return
      const saved = localStorage.getItem(draftKey)
      if (!saved) return
      try {
        const draft = JSON.parse(saved) as RowDraft
        if (!draft.editing || typeof draft.editing !== 'object') return
        setEditing(draft.editing)
        setOriginal(draft.original ?? null)
        setNulls(draft.nulls ?? {})
        setNotice('Несохранённый черновик восстановлен')
      } catch { localStorage.removeItem(draftKey) }
    })
  }, [open, load, draftKey])

  useEffect(() => {
    if (!open || !editing || !draftKey) return
    try { localStorage.setItem(draftKey, serializeDraft({ editing, original, nulls })) } catch { setError('Браузер не разрешил сохранить черновик локально') }
  }, [open, editing, original, nulls, draftKey])

  const startEdit = (row: Row | null) => {
    setNotice('')
    setOriginal(row)
    setEditing(row ? { ...row } : Object.fromEntries(table?.columns.map((column) => [column.name, '']) ?? []))
    setNulls(Object.fromEntries(table?.columns.map((column) => [column.name, row?.[column.name] === null]) ?? []))
  }
  const cancelEdit = () => {
    clearDraft()
    setEditing(null)
    setOriginal(null)
    setNotice('')
  }
  const generate = async () => {
    if (!adapter || !table) return
    setGenerating(true); setError('')
    try {
      const generated = await generateValidRow(table, schema.relationships, result?.rows ?? [], (name) => adapter.readTable(name, 200).then((value) => value.rows))
      setEditing(generated)
      setNulls({})
      setNotice('Значения сгенерированы. Проверьте их и сохраните строку.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) } finally { setGenerating(false) }
  }
  const save = async () => {
    if (!adapter || !tableName || !editing || !table) return
    try {
      const row = Object.fromEntries(table.columns.map((column) => [column.name, typedValue(inputValue(editing[column.name]), nulls[column.name], column.dataType)]))
      if (original) await adapter.updateRow(tableName, row, original)
      else await adapter.insertRow(tableName, row)
      clearDraft(); setEditing(null); setOriginal(null); setNotice(''); await load(); onChanged()
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
        {notice && <div role="status" className="mb-2 rounded-lg bg-primary/10 p-3 text-xs text-primary">{notice}</div>}
        {editing ? <div className="flex min-h-0 flex-1 flex-col">
          <div className="mb-3 flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{original ? 'Редактирование строки' : 'Новая строка · черновик сохраняется автоматически'}</span>{!original && <Button variant="outline" size="sm" disabled={generating} onClick={() => void generate()}><WandSparkles size={14} />{generating ? 'Генерируем…' : 'Случайные значения'}</Button>}</div>
          <div className="grid min-h-0 flex-1 content-start gap-3 overflow-auto md:grid-cols-2">{table?.columns.map((column) => <label key={column.name} className="text-xs font-medium">{column.name}<span className="ml-1 font-normal text-muted-foreground">{column.dataType}{column.primaryKey ? ' · PK' : ''}{column.foreignKey ? ' · FK' : ''}</span><div className="mt-1 flex gap-2"><Input value={inputValue(editing[column.name])} disabled={nulls[column.name] || (original !== null && column.primaryKey)} onChange={(event) => setEditing({ ...editing, [column.name]: event.target.value })} /><label className="flex items-center gap-1 text-[11px] font-normal"><input type="checkbox" disabled={original !== null && column.primaryKey} checked={nulls[column.name] ?? false} onChange={(event) => setNulls({ ...nulls, [column.name]: event.target.checked })} />NULL</label></div></label>)}</div>
          <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={cancelEdit}>Отмена</Button><Button onClick={() => void save()}>Сохранить строку</Button></div>
        </div> : <>
          <div className="mb-3 flex flex-wrap gap-2"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск по текущим строкам" className="max-w-xs" /><Button variant="outline" size="sm" onClick={() => startEdit(null)}><Plus size={14} />Строка</Button><Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload size={14} />CSV / JSON</Button><input ref={fileRef} type="file" accept=".csv,.json" className="hidden" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { const imported = parseDataImport(await file.text(), file.name.split('.').pop()?.toLowerCase() ?? 'csv'); setImportPreview(imported.slice(0, 500)); setError(imported.length > 500 ? 'Импорт ограничен первыми 500 строками' : '') } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) } event.target.value = '' }} /><Button variant="ghost" size="icon" className="ml-auto" onClick={() => void load()} aria-label="Обновить"><RefreshCw size={15} /></Button></div>
          {importPreview.length > 0 && <div className="mb-3 flex items-center gap-3 rounded-lg bg-secondary p-3 text-xs"><span>Готово к импорту: {importPreview.length} строк</span><Button size="sm" onClick={() => void importRows()}>Импортировать</Button><Button variant="ghost" size="sm" onClick={() => setImportPreview([])}>Отмена</Button></div>}
          <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border"><table className="w-full border-collapse font-mono text-xs"><thead className="sticky top-0 bg-secondary"><tr>{table?.columns.map((column) => <th key={column.name} className="px-3 py-2 text-left">{column.name}</th>)}<th className="w-16" /></tr></thead><tbody>{rows.map((row, index) => <tr key={index} className="border-t border-border/60">{table?.columns.map((column) => <td key={column.name} className="max-w-48 truncate px-3 py-2" title={displayValue(row[column.name])}><button className="cursor-pointer text-left" onClick={() => startEdit(row)}>{displayValue(row[column.name])}</button></td>)}<td><Button variant="ghost" size="icon" className="size-7" aria-label="Удалить строку" onClick={async () => { if (!adapter || !tableName || !confirm('Удалить эту строку?')) return; try { await adapter.deleteRow(tableName, row); await load(); onChanged() } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) } }}><Trash2 size={13} /></Button></td></tr>)}</tbody></table>{!rows.length && <div className="p-8 text-center text-sm text-muted-foreground">Строк не найдено</div>}</div>
        </>}
      </DialogContent>
    </Dialog>
  )
}
