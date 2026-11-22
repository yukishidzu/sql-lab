import { useState } from 'react'
import { Plus, RefreshCw, Trash2 } from 'lucide-react'
import type { ScenarioDefinition } from '../types'
import { quoteIdentifier } from '../lib/utils'
import { Button } from './ui/button'
import { Dialog, DialogContent } from './ui/dialog'
import { Input, Textarea } from './ui/input'

type DraftColumn = { name: string; type: string; primary: boolean }

export function ScenarioEditor({ open, onOpenChange, scenario, onApply, onCaptureData }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  scenario: ScenarioDefinition
  onApply: (scenario: ScenarioDefinition) => Promise<void>
  onCaptureData: () => Promise<ScenarioDefinition['data']>
}) {
  const [name, setName] = useState(scenario.name)
  const [ddl, setDdl] = useState(scenario.schemaSql)
  const [data, setData] = useState(scenario.data)
  const [creating, setCreating] = useState(false)
  const [tableName, setTableName] = useState('')
  const [columns, setColumns] = useState<DraftColumn[]>([{ name: 'id', type: 'integer', primary: true }, { name: 'name', type: 'text', primary: false }])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const addTable = () => {
    if (!/^[a-z_][a-z0-9_]*$/.test(tableName) || columns.some((column) => !/^[a-z_][a-z0-9_]*$/.test(column.name))) {
      setError('Используйте для таблиц и колонок строчные латинские буквы, цифры и _')
      return
    }
    const primary = columns.filter((column) => column.primary).map((column) => quoteIdentifier(column.name))
    const definitions = columns.map((column) => `  ${quoteIdentifier(column.name)} ${column.type}${column.primary && primary.length === 1 ? ' PRIMARY KEY' : ' NOT NULL'}`)
    if (primary.length > 1) definitions.push(`  PRIMARY KEY (${primary.join(', ')})`)
    setDdl(`${ddl.trim()}\n\nCREATE TABLE ${quoteIdentifier(tableName)} (\n${definitions.join(',\n')}\n);\n`)
    setCreating(false); setTableName(''); setError('')
  }
  const apply = async () => {
    setBusy(true); setError('')
    try {
      await onApply({ ...scenario, name, schemaSql: ddl, data, notes: scenario.notes })
      onOpenChange(false)
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) } finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Редактор сценария" description="DDL и исходные данные шаблона. Применение пересобирает текущую базу." className="flex h-[88vh] max-w-5xl flex-col">
        {error && <div role="alert" className="mb-3 whitespace-pre-wrap rounded-lg bg-destructive/10 p-3 text-xs text-destructive">{error}</div>}
        <div className="mb-3 flex flex-wrap items-end gap-2"><label className="flex-1 text-xs font-medium">Название сценария<Input className="mt-1" value={name} onChange={(event) => setName(event.target.value)} /></label><Button variant="outline" onClick={() => setCreating(true)}><Plus size={15} />Новая таблица</Button><Button variant="outline" onClick={async () => { try { setData(await onCaptureData()); setError('') } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) } }}><RefreshCw size={15} />Взять данные из живой БД</Button></div>
        <label className="flex min-h-0 flex-1 flex-col text-xs font-medium">DDL PostgreSQL<Textarea value={ddl} onChange={(event) => setDdl(event.target.value)} spellCheck={false} className="mt-1 min-h-0 flex-1 resize-none font-mono text-xs leading-relaxed" /></label>
        <div className="mt-4 flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">Сначала сценарий проверяется во временной базе. Исследовательские изменения будут заменены.</span><Button disabled={busy} onClick={() => { if (confirm('Пересобрать текущую базу из этого сценария?')) void apply() }}>{busy ? 'Проверяем…' : 'Проверить и применить'}</Button></div>
      </DialogContent>
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent title="Новая таблица" description="Базовый конструктор. Сложные изменения доступны в DDL.">
          <label className="text-xs font-medium">Имя таблицы<Input className="mt-1" value={tableName} onChange={(event) => setTableName(event.target.value)} placeholder="products" /></label>
          <div className="mt-4 space-y-2">{columns.map((column, index) => <div key={index} className="flex gap-2"><Input value={column.name} aria-label="Имя колонки" onChange={(event) => setColumns(columns.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} /><Input value={column.type} aria-label="Тип колонки" onChange={(event) => setColumns(columns.map((item, itemIndex) => itemIndex === index ? { ...item, type: event.target.value } : item))} /><label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={column.primary} onChange={(event) => setColumns(columns.map((item, itemIndex) => itemIndex === index ? { ...item, primary: event.target.checked } : item))} />PK</label><Button variant="ghost" size="icon" disabled={columns.length <= 1} onClick={() => setColumns(columns.filter((_, itemIndex) => itemIndex !== index))} aria-label="Удалить колонку"><Trash2 size={14} /></Button></div>)}</div>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setColumns([...columns, { name: '', type: 'text', primary: false }])}><Plus size={14} />Колонка</Button>
          <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={() => setCreating(false)}>Отмена</Button><Button onClick={addTable}>Добавить в DDL</Button></div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
