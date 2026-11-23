import { useState } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import type { ScenarioDefinition, SchemaInfo } from '../types'
import { Button } from './ui/button'
import { Dialog, DialogContent } from './ui/dialog'
import { Input, Textarea } from './ui/input'
import { TableBuilder } from './TableBuilder'

export function ScenarioEditor({ open, onOpenChange, scenario, schema, onApply, onCaptureData }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  scenario: ScenarioDefinition
  schema: SchemaInfo
  onApply: (scenario: ScenarioDefinition) => Promise<void>
  onCaptureData: () => Promise<ScenarioDefinition['data']>
}) {
  const [name, setName] = useState(scenario.name)
  const [ddl, setDdl] = useState(scenario.schemaSql)
  const [data, setData] = useState(scenario.data)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const apply = async () => {
    setBusy(true); setError('')
    try {
      await onApply({ ...scenario, name, schemaSql: ddl, data, notes: scenario.notes })
      onOpenChange(false)
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) } finally { setBusy(false) }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent title="Редактор сценария" description="DDL и исходные данные шаблона. Применение пересобирает текущую базу." className="flex h-[88vh] max-w-5xl flex-col">
          {error && <div role="alert" className="mb-3 whitespace-pre-wrap rounded-lg bg-destructive/10 p-3 text-xs text-destructive">{error}</div>}
          <div className="mb-3 flex flex-wrap items-end gap-2"><label className="flex-1 text-xs font-medium">Название сценария<Input className="mt-1" value={name} onChange={(event) => setName(event.target.value)} /></label><Button variant="outline" onClick={() => setCreating(true)}><Plus size={15} />Новая таблица</Button><Button variant="outline" onClick={async () => { try { setData(await onCaptureData()); setError('') } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) } }}><RefreshCw size={15} />Взять данные из живой БД</Button></div>
          <label className="flex min-h-0 flex-1 flex-col text-xs font-medium">DDL PostgreSQL<Textarea value={ddl} onChange={(event) => setDdl(event.target.value)} spellCheck={false} className="mt-1 min-h-0 flex-1 resize-none font-mono text-xs leading-relaxed" /></label>
          <div className="mt-4 flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">Сначала сценарий проверяется во временной базе. Исследовательские изменения будут заменены.</span><Button disabled={busy} onClick={() => { if (confirm('Пересобрать текущую базу из этого сценария?')) void apply() }}>{busy ? 'Проверяем…' : 'Проверить и применить'}</Button></div>
        </DialogContent>
      </Dialog>
      {creating && <TableBuilder open={creating} onOpenChange={setCreating} schema={schema} onAdd={(sql) => {
        setDdl(`${ddl.trim()}\n\n${sql}\n`)
        setCreating(false)
        setError('')
      }} />}
    </>
  )
}
