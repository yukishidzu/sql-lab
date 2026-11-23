import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowLeftRight, Check, ChevronDown, ChevronUp, Database, Download, Eye, EyeOff, FileCode2, History, Link2, Loader2, Moon, Play, Plus, Save, Settings2, Sun } from 'lucide-react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { store, recordRun, saveNamedQuery, touchWorkspace } from '../lib/store'
import type { DatabaseAdapter, QueryResult, QueryRun, SavedQuery, ScenarioDefinition, SchemaInfo, SqlTask, SqlValue, Workspace } from '../types'
import { SqlEditor, type SqlEditorHandle } from '../components/SqlEditor'
import { ResultTable } from '../components/ResultTable'
import { SchemaGraph } from '../components/SchemaGraph'
import { NotesPanel } from '../components/NotesPanel'
import { QuerySidebar } from '../components/QuerySidebar'
import { DataDrawer } from '../components/DataDrawer'
import { ScenarioEditor } from '../components/ScenarioEditor'
import { Button } from '../components/ui/button'
import { Dialog, DialogContent } from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { downloadFile } from '../lib/utils'
import { createShareUrl, makeBackup } from '../lib/share'
import { useTheme } from '../lib/theme'
import { useMediaQuery } from '../lib/useMediaQuery'
import { checkTask } from '../lib/tasks'

const emptySchema: SchemaInfo = { tables: [], relationships: [] }

type PanelLayout = Record<string, number>

function readPanelLayout(key: string, fallback: PanelLayout): PanelLayout {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null') as unknown
    if (value && typeof value === 'object' && Object.values(value).every((size) => typeof size === 'number' && size > 0 && size <= 100)) return value as PanelLayout
  } catch {}
  return fallback
}

function writePanelLayout(key: string, layout: PanelLayout) {
  try { localStorage.setItem(key, JSON.stringify(layout)) } catch {}
}

export function WorkspacePage({ id }: { id: string }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [adapter, setAdapter] = useState<DatabaseAdapter | null>(null)
  const [schema, setSchema] = useState<SchemaInfo>(emptySchema)
  const [queries, setQueries] = useState<SavedQuery[]>([])
  const [runs, setRuns] = useState<QueryRun[]>([])
  const [result, setResult] = useState<QueryResult | null>(null)
  const [error, setError] = useState('')
  const [fatal, setFatal] = useState('')
  const [running, setRunning] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [queryName, setQueryName] = useState('')
  const [sidebar, setSidebar] = useState(false)
  const [notesCollapsed, setNotesCollapsed] = useState(true)
  const [tableName, setTableName] = useState<string | null>(null)
  const [scenarioOpen, setScenarioOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [toast, setToast] = useState('')
  const [mobileTab, setMobileTab] = useState<'schema' | 'sql' | 'notes'>('sql')
  const [schemaVisible, setSchemaVisible] = useState(true)
  const [resultVisible, setResultVisible] = useState(true)
  const [panelsSwapped, setPanelsSwapped] = useState(true)
  const [horizontalLayout, setHorizontalLayout] = useState<PanelLayout>(() => readPanelLayout(`sql-lab-horizontal:${id}`, { sql: 52, schema: 48 }))
  const [verticalLayout, setVerticalLayout] = useState<PanelLayout>(() => readPanelLayout(`sql-lab-vertical:${id}`, { editor: 56, result: 44 }))
  const editorRef = useRef<SqlEditorHandle>(null)
  const introspectVersion = useRef(0)
  const { dark, change, theme } = useTheme()
  const mobile = useMediaQuery('(max-width: 767px)')

  const refreshSchema = useCallback(async (database?: DatabaseAdapter) => {
    const target = database ?? adapter
    if (!target) return
    const version = ++introspectVersion.current
    const next = await target.introspect()
    if (version === introspectVersion.current) {
      setSchema((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next)
    }
  }, [adapter])
  const loadQueries = useCallback(async (workspaceId: string) => {
    setQueries(await store.queries.where('workspaceId').equals(workspaceId).sortBy('updatedAt'))
    setRuns((await store.runs.where('workspaceId').equals(workspaceId).sortBy('createdAt')).reverse())
  }, [])

  useEffect(() => {
    let active = true
    let database: DatabaseAdapter | null = null
    async function open() {
      try {
        const record = await store.workspaces.get(id)
        if (!record) { setFatal('Рабочее пространство не найдено. Оно могло быть удалено или создано в другом браузере.'); return }
        if (!active) return
        setWorkspace(record)
        void navigator.storage?.persist?.()
        const { openDatabase } = await import('../db/client')
        database = await openDatabase(id, record.scenario, record.initialized, record.initialDump)
        if (!active) { await database.close(); return }
        setSchema(await database.introspect())
        if (!record.initialized) await touchWorkspace(id, { initialized: true, initialDump: undefined })
        setAdapter(database)
        let saved = await store.queries.where('workspaceId').equals(id).sortBy('updatedAt')
        if (!saved.length && record.scenario.starterQueries.length) {
          for (const query of record.scenario.starterQueries) await saveNamedQuery(id, query.name, query.sql, true)
          saved = await store.queries.where('workspaceId').equals(id).sortBy('updatedAt')
        }
        setQueries(saved)
        setRuns((await store.runs.where('workspaceId').equals(id).sortBy('createdAt')).reverse())
      } catch (reason) { if (active) setFatal(reason instanceof Error ? reason.message : String(reason)) }
    }
    void open()
    return () => { active = false; if (database) void database.close() }
  }, [id])

  useEffect(() => {
    if (!workspace) return
    const timer = setTimeout(() => { void touchWorkspace(workspace.id, { draft: workspace.draft, notes: workspace.notes, name: workspace.name, scenario: workspace.scenario }) }, 350)
    return () => clearTimeout(timer)
  }, [workspace])

  const notify = (message: string) => { setToast(message); setTimeout(() => setToast(''), 2200) }
  const changeDraft = (draft: string) => {
    setWorkspace((current) => current ? { ...current, draft } : current)
    void touchWorkspace(id, { draft })
  }
  const changeNotes = (notes: string) => {
    setWorkspace((current) => current ? { ...current, notes, scenario: { ...current.scenario, notes } } : current)
    void touchWorkspace(id, { notes })
  }
  const changeTasks = (tasks: SqlTask[]) => {
    setWorkspace((current) => {
      if (!current) return current
      const scenario = { ...current.scenario, tasks }
      void touchWorkspace(id, { scenario })
      return { ...current, scenario }
    })
  }
  const runQuery = useCallback(async () => {
    if (!adapter || !workspace || running || !workspace.draft.trim()) return
    setRunning(true); setError(''); setResult(null)
    const startedAt = performance.now()
    try {
      const next = await adapter.executeOne(workspace.draft)
      setResult(next)
      await recordRun({ workspaceId: workspace.id, sql: workspace.draft, status: 'success', durationMs: next.durationMs, rowCount: next.rowCount })
      await refreshSchema(adapter)
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason)
      setError(message)
      await recordRun({ workspaceId: workspace.id, sql: workspace.draft, status: 'error', durationMs: performance.now() - startedAt, rowCount: 0, error: message })
    } finally {
      setRunning(false)
      await loadQueries(workspace.id)
    }
  }, [adapter, workspace, running, refreshSchema, loadQueries])

  const saveQuery = async () => {
    if (!workspace || !queryName.trim()) return
    await saveNamedQuery(workspace.id, queryName.trim(), workspace.draft)
    setQueryName(''); setSaveOpen(false); await loadQueries(workspace.id); notify('Запрос сохранён')
  }
  const insertColumn = useCallback((text: string) => { editorRef.current?.insert(text) }, [])
  const updateLayout = useCallback((layout: Record<string, { x: number; y: number }>) => {
    setWorkspace((current) => current ? { ...current, scenario: { ...current.scenario, layout } } : current)
  }, [])
  const captureData = useCallback(async (): Promise<ScenarioDefinition['data']> => {
    if (!adapter) throw new Error('База ещё не загружена')
    const data: Record<string, Record<string, SqlValue>[]> = {}
    const ordered: string[] = []
    const visited = new Set<string>()
    const visit = (name: string) => {
      if (visited.has(name)) return
      visited.add(name)
      schema.relationships.filter((relation) => relation.sourceTable === name).forEach((relation) => visit(relation.targetTable))
      if (schema.tables.some((table) => table.name === name)) ordered.push(name)
    }
    schema.tables.forEach((table) => visit(table.name))
    for (const table of ordered) data[table] = (await adapter.readTable(table, 10000)).rows
    return data
  }, [adapter, schema])
  const applyScenario = async (scenario: ScenarioDefinition) => {
    if (!adapter || !workspace) return
    const { validateScenario } = await import('../db/client')
    const next = { ...scenario, notes: workspace.notes }
    await validateScenario(next)
    await adapter.reset(next)
    setWorkspace({ ...workspace, name: next.name, scenario: next })
    await refreshSchema(adapter); notify('Сценарий применён')
  }
  const share = async () => {
    if (!workspace) return
    try {
      const scenario = { ...workspace.scenario, notes: workspace.notes, data: await captureData() }
      setShareUrl(await createShareUrl(scenario)); setCopied(false)
    } catch (reason) { notify(reason instanceof Error ? reason.message : String(reason)) }
  }
  const exportBackup = async () => {
    if (!adapter || !workspace) return
    try {
      const dump = await adapter.dump()
      const backup = makeBackup({ ...workspace, initialized: true, scenario: { ...workspace.scenario, notes: workspace.notes } }, queries, runs, dump)
      downloadFile(`${workspace.name.replaceAll(/[^a-zа-я0-9]+/gi, '-')}.sqllab.json`, JSON.stringify(backup))
      notify('Резервная копия скачана')
    } catch (reason) { notify(reason instanceof Error ? reason.message : String(reason)) }
  }

  const updateHorizontalLayout = (next: PanelLayout) => {
    if (!schemaVisible) return
    setHorizontalLayout(next)
    writePanelLayout(`sql-lab-horizontal:${id}`, next)
  }
  const updateVerticalLayout = (next: PanelLayout) => {
    if (!resultVisible) return
    setVerticalLayout(next)
    writePanelLayout(`sql-lab-vertical:${id}`, next)
  }

  if (fatal) return <div className="grid h-full place-items-center p-6"><div className="max-w-md rounded-xl border border-border bg-card p-6 text-center"><Database className="mx-auto mb-3 text-destructive" /><h1 className="mb-2 font-semibold">Не удалось открыть базу</h1><p className="mb-4 whitespace-pre-wrap text-sm text-muted-foreground">{fatal}</p><Button onClick={() => { location.hash = '/' }}>На главную</Button></div></div>
  if (!workspace || !adapter) return <div className="grid h-full place-items-center bg-background"><div className="flex items-center gap-3 text-sm text-muted-foreground"><Loader2 className="animate-spin text-primary" />Загружаем PostgreSQL в браузере…</div></div>

  const editorPanel = <div className="flex h-full min-h-0 flex-col"><div className="flex h-11 items-center gap-2 border-b border-border bg-card px-3"><FileCode2 size={15} className="text-primary" /><span className="text-sm font-medium">SQL</span><span className="ml-auto text-[11px] text-muted-foreground">Ctrl/Cmd + Enter</span>{!schemaVisible && <Button variant="ghost" size="sm" className="hidden md:inline-flex" onClick={() => setSchemaVisible(true)}><Eye size={14} />Схема</Button>}<Button variant="ghost" size="icon" className="hidden size-8 md:inline-flex" onClick={() => setPanelsSwapped(!panelsSwapped)} aria-label="Поменять панели местами" title="Поменять панели местами"><ArrowLeftRight size={15} /></Button><Button variant="ghost" size="sm" onClick={() => setSaveOpen(true)}><Save size={14} />Сохранить</Button><Button size="sm" disabled={running || !workspace.draft.trim()} onClick={() => void runQuery()}><Play size={14} />Выполнить</Button></div><div className="min-h-0 flex-1"><SqlEditor ref={editorRef} value={workspace.draft} onChange={changeDraft} schema={schema} dark={dark} onRun={() => void runQuery()} onSave={() => setSaveOpen(true)} /></div></div>
  const schemaPanel = <SchemaGraph schema={schema} layout={workspace.scenario.layout} dark={dark} onLayoutChange={updateLayout} onTableOpen={setTableName} onColumnInsert={insertColumn} onHide={!mobile ? () => setSchemaVisible(false) : undefined} />
  const resultPanel = <div className="flex h-full min-h-0 flex-col"><div className="flex h-9 shrink-0 items-center border-b border-border bg-card px-3"><span className="text-xs font-medium">Результат</span><Button variant="ghost" size="icon" className="ml-auto size-7" onClick={() => setResultVisible(false)} aria-label="Скрыть результат" title="Скрыть результат"><EyeOff size={14} /></Button></div><div className="min-h-0 flex-1"><ResultTable result={result} error={error} running={running} /></div></div>
  const sqlWorkspace = <div className="flex h-full min-h-0 flex-col"><div className="min-h-0 flex-1"><Group orientation="vertical" defaultLayout={verticalLayout} onLayoutChanged={updateVerticalLayout}><Panel id="editor" defaultSize="56%" minSize="25%">{editorPanel}</Panel>{resultVisible && <Separator className="h-1 cursor-row-resize bg-border hover:bg-primary" />}{resultVisible && <Panel id="result" minSize="20%">{resultPanel}</Panel>}</Group></div>{!resultVisible && <button className="flex h-9 shrink-0 cursor-pointer items-center justify-center gap-2 border-t border-border bg-card text-xs text-muted-foreground hover:bg-accent" onClick={() => setResultVisible(true)}><ChevronUp size={14} />Показать результат</button>}</div>
  const desktopSqlPanel = <Panel key="sql" id="sql" minSize="35%">{sqlWorkspace}</Panel>
  const desktopSchemaPanel = <Panel key="schema" id="schema" defaultSize="48%" minSize="28%">{schemaPanel}</Panel>
  const horizontalSeparator = <Separator key="horizontal-separator" className="w-1 cursor-col-resize bg-border transition-colors hover:bg-primary" />

  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
      <header className="flex min-h-14 flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2">
        <h1 className="sr-only">{workspace.name}</h1>
        <Button variant="ghost" size="icon" onClick={() => { location.hash = '/' }} aria-label="На главную"><ArrowLeft size={18} /></Button>
        <input value={workspace.name} onChange={(event) => setWorkspace({ ...workspace, name: event.target.value })} className="min-w-0 max-w-56 flex-1 rounded-md bg-transparent px-1 text-sm font-semibold outline-none focus:bg-accent" aria-label="Название рабочего пространства" />
        <Badge className="hidden sm:inline-flex">PostgreSQL · локально</Badge>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setSidebar(!sidebar)}><History size={15} /><span className="hidden lg:inline">Запросы</span></Button>
          <Button variant="ghost" size="sm" onClick={() => setScenarioOpen(true)}><Settings2 size={15} /><span className="hidden lg:inline">Сценарий</span></Button>
          <Button variant="ghost" size="icon" onClick={() => void share()} aria-label="Поделиться сценарием"><Link2 size={16} /></Button>
          <Button variant="ghost" size="icon" onClick={() => void exportBackup()} aria-label="Экспорт резервной копии"><Download size={16} /></Button>
          <Button variant="ghost" size="icon" onClick={() => change(dark ? 'light' : 'dark')} aria-label={`Тема: ${theme}`}>{dark ? <Sun size={16} /> : <Moon size={16} />}</Button>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileTab('notes')} aria-label="Открыть задания"><ChevronDown size={16} /></Button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        {sidebar && <div className="fixed inset-0 z-40"><button className="absolute inset-0 cursor-default bg-black/15" onClick={() => setSidebar(false)} aria-label="Закрыть панель запросов" /><div className="absolute bottom-0 left-0 top-14 w-80 max-w-[90vw] border-r border-border bg-card shadow-2xl"><QuerySidebar queries={queries} runs={runs} onOpen={(draft) => { setWorkspace({ ...workspace, draft }); setSidebar(false) }} onRename={async (queryId, name) => { await store.queries.update(queryId, { name, updatedAt: Date.now() }); await loadQueries(id) }} onDelete={async (queryId) => { if (confirm('Удалить сохранённый запрос?')) { await store.queries.delete(queryId); await loadQueries(id) } }} onClose={() => setSidebar(false)} /></div></div>}
        {!mobile ? <main className="min-w-0 flex-1">
          <Group className="min-w-0 flex-1" defaultLayout={horizontalLayout} onLayoutChanged={updateHorizontalLayout}>
            {panelsSwapped && desktopSqlPanel}
            {panelsSwapped && schemaVisible && horizontalSeparator}
            {schemaVisible && desktopSchemaPanel}
            {!panelsSwapped && schemaVisible && horizontalSeparator}
            {!panelsSwapped && desktopSqlPanel}
          </Group>
        </main> : <main className="min-w-0 flex-1">
          <div className="flex h-10 items-center gap-1 border-b border-border px-2"><Button variant={mobileTab === 'schema' ? 'secondary' : 'ghost'} size="sm" onClick={() => setMobileTab('schema')}>Схема</Button><Button variant={mobileTab === 'sql' ? 'secondary' : 'ghost'} size="sm" onClick={() => setMobileTab('sql')}>SQL</Button><Button variant={mobileTab === 'notes' ? 'secondary' : 'ghost'} size="sm" onClick={() => setMobileTab('notes')}>Задания</Button></div>
          <div className="h-[calc(100%-2.5rem)]">{mobileTab === 'schema' ? schemaPanel : mobileTab === 'sql' ? <div className="flex h-full flex-col"><div className="h-3/5 min-h-56">{editorPanel}</div><div className="min-h-0 flex-1 border-t border-border"><ResultTable result={result} error={error} running={running} /></div></div> : <NotesPanel notes={workspace.notes} onChange={changeNotes} tasks={workspace.scenario.tasks ?? []} onTasksChange={changeTasks} onCheckTask={(task) => checkTask(adapter, task, workspace.draft)} collapsed={false} onToggle={() => setMobileTab('sql')} />}</div>
        </main>}
        <div className="hidden shrink-0 md:block"><NotesPanel notes={workspace.notes} onChange={changeNotes} tasks={workspace.scenario.tasks ?? []} onTasksChange={changeTasks} onCheckTask={(task) => checkTask(adapter, task, workspace.draft)} collapsed={notesCollapsed} onToggle={() => setNotesCollapsed(!notesCollapsed)} /></div>
      </div>
      <DataDrawer workspaceId={id} tableName={tableName} table={schema.tables.find((table) => table.name === tableName)} schema={schema} adapter={adapter} open={tableName !== null} onOpenChange={(open) => { if (!open) setTableName(null) }} onChanged={() => void refreshSchema()} />
      {scenarioOpen && <ScenarioEditor open={scenarioOpen} onOpenChange={setScenarioOpen} scenario={{ ...workspace.scenario, notes: workspace.notes }} schema={schema} onApply={applyScenario} onCaptureData={captureData} />}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}><DialogContent title="Сохранить запрос" description="Название поможет быстро найти его в этом рабочем пространстве."><form onSubmit={(event) => { event.preventDefault(); void saveQuery() }}><Input autoFocus value={queryName} onChange={(event) => setQueryName(event.target.value)} placeholder="Например: доход по месяцам" /><div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={() => setSaveOpen(false)}>Отмена</Button><Button type="submit" disabled={!queryName.trim()}><Save size={14} />Сохранить</Button></div></form></DialogContent></Dialog>
      <Dialog open={Boolean(shareUrl)} onOpenChange={(open) => { if (!open) setShareUrl('') }}><DialogContent title="Ссылка на независимую копию" description="Схема, текущие данные, заметки и стартовые запросы включены. Личная история остаётся в вашем браузере."><TextareaShare value={shareUrl} /><div className="mt-4 flex justify-end"><Button onClick={async () => { await navigator.clipboard.writeText(shareUrl); setCopied(true) }}>{copied ? <Check size={15} /> : <Plus size={15} />}{copied ? 'Скопировано' : 'Копировать ссылку'}</Button></div></DialogContent></Dialog>
      {toast && <div role="status" className="fixed bottom-4 left-1/2 z-[70] max-w-lg -translate-x-1/2 rounded-lg border border-border bg-card px-4 py-2 text-sm shadow-xl">{toast}</div>}
    </div>
  )
}

function TextareaShare({ value }: { value: string }) {
  return <textarea readOnly value={value} className="h-28 w-full resize-none rounded-lg border border-input bg-background p-3 font-mono text-xs" onFocus={(event) => event.target.select()} aria-label="Ссылка на сценарий" />
}
