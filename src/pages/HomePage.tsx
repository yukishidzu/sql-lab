import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Copy, CopyPlus, Database, FilePlus2, Import, Moon, MoreHorizontal, Sun, Trash2 } from 'lucide-react'
import { emptyScenario, presets } from '../data/presets'
import { createWorkspaceRecord, store } from '../lib/store'
import { parseBackup } from '../lib/share'
import { useTheme } from '../lib/theme'
import type { Workspace } from '../types'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'

function GitHubIcon() {
  return <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" /></svg>
}

function warmDatabaseEngine() {
  void import('../db/client').then(({ preloadDatabaseEngine }) => preloadDatabaseEngine()).catch(() => {})
}

export function HomePage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const { dark, change } = useTheme()
  const load = async () => setWorkspaces((await store.workspaces.toArray()).sort((a, b) => b.updatedAt - a.updatedAt))
  useEffect(() => {
    void load()
    const warmup = setTimeout(warmDatabaseEngine, 800)
    return () => clearTimeout(warmup)
  }, [])
  const open = (id: string) => { location.hash = `/w/${id}` }
  const create = async (scenario: Workspace['scenario']) => { const workspace = await createWorkspaceRecord(scenario); open(workspace.id) }
  const importBackup = async (file: File) => {
    try {
      const backup = parseBackup(await file.text())
      const workspace = await createWorkspaceRecord(backup.workspace.scenario)
      await store.workspaces.update(workspace.id, {
        name: backup.workspace.name,
        draft: backup.workspace.draft,
        notes: backup.workspace.notes,
        initialDump: backup.dump,
      })
      for (const query of backup.queries ?? []) await store.queries.add({ ...query, id: crypto.randomUUID(), workspaceId: workspace.id })
      for (const run of backup.runs ?? []) await store.runs.add({ ...run, id: crypto.randomUUID(), workspaceId: workspace.id })
      open(workspace.id)
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
  }

  return (
    <div className="min-h-full bg-[#f5f6f8] text-foreground dark:bg-[#14161a]">
      <header className="mx-auto flex max-w-6xl items-center px-5 py-5"><h1 className="sr-only">SQL Lab — сценарии и рабочие пространства</h1><div className="flex items-center gap-2 font-semibold"><span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground"><Database size={17} /></span>SQL Lab</div><div className="ml-auto flex gap-1"><Button variant="ghost" size="icon" onClick={() => fileRef.current?.click()} aria-label="Импортировать резервную копию"><Import size={17} /></Button><Button variant="ghost" size="icon" onClick={() => change(dark ? 'light' : 'dark')} aria-label="Переключить тему">{dark ? <Sun size={17} /> : <Moon size={17} />}</Button></div></header>
      <main className="mx-auto max-w-6xl px-5 py-6">
        {error && <div role="alert" className="mb-5 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        <section><div className="mb-4 flex items-end justify-between"><div><h2 className="text-xl font-semibold">Выберите учебный сценарий</h2></div><Button variant="outline" onClick={() => void create(emptyScenario())}><FilePlus2 size={15} />Пустая база</Button></div>
          <div className="grid gap-4 md:grid-cols-3">{presets.map((preset) => <button key={preset.id} onClick={() => void create(structuredClone(preset.scenario))} onPointerEnter={warmDatabaseEngine} onFocus={warmDatabaseEngine} className="group cursor-pointer rounded-xl border border-border bg-card p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"><div className="mb-5 flex items-center justify-between"><span className="grid size-10 place-items-center rounded-lg text-white" style={{ backgroundColor: preset.accent }}><Database size={19} /></span><ArrowRight size={17} className="text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" /></div><h3 className="font-semibold">{preset.name}</h3><p className="mt-2 min-h-16 text-sm leading-relaxed text-muted-foreground">{preset.description}</p><div className="mt-4 flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{Object.keys(preset.scenario.data).length} таблиц · 10 заданий</span><Badge>{preset.difficulty}</Badge></div></button>)}</div>
        </section>
        <section className="mt-12"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-xl font-semibold">Мои рабочие пространства</h2><p className="mt-1 text-sm text-muted-foreground">История доступна по той же ссылке в этом браузере.</p></div><Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}><Import size={14} />Импорт .sqllab.json</Button></div>
          <div className="overflow-hidden rounded-xl border border-border bg-card">{workspaces.map((workspace) => <div key={workspace.id} className="group flex items-center gap-3 border-b border-border/70 px-4 py-3 last:border-0"><button className="min-w-0 flex-1 cursor-pointer text-left" onClick={() => open(workspace.id)}><div className="truncate text-sm font-medium group-hover:text-primary">{workspace.name}</div><div className="mt-1 text-xs text-muted-foreground">Изменено {new Date(workspace.updatedAt).toLocaleString('ru-RU')}</div></button><Button variant="ghost" size="icon" aria-label="Копировать ссылку рабочего пространства" onClick={async () => { await navigator.clipboard.writeText(`${location.origin}${location.pathname}#/w/${workspace.id}`) }}><Copy size={15} /></Button><Button variant="ghost" size="icon" aria-label="Дублировать сценарий" onClick={() => void create({ ...structuredClone(workspace.scenario), name: `${workspace.name} — копия`, notes: workspace.notes })}><CopyPlus size={15} /></Button><Button variant="ghost" size="icon" aria-label="Удалить рабочее пространство" onClick={async () => { if (!confirm(`Удалить «${workspace.name}» и локальную базу? Сначала можно сделать экспорт внутри пространства.`)) return; try { const { deleteWorkspaceDatabase } = await import('../db/client'); await deleteWorkspaceDatabase(workspace.id); await store.workspaces.delete(workspace.id); await store.queries.where('workspaceId').equals(workspace.id).delete(); await store.runs.where('workspaceId').equals(workspace.id).delete(); await load() } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) } }}><Trash2 size={15} /></Button></div>)}{!workspaces.length && <div className="p-10 text-center"><MoreHorizontal className="mx-auto mb-2 text-muted-foreground" /><p className="text-sm text-muted-foreground">Здесь появятся ваши базы после создания.</p></div>}</div>
        </section>
      </main>
      <footer className="flex items-center justify-center gap-2 border-t border-border px-4 py-5 text-xs text-muted-foreground"><span>SQL Lab</span><span aria-hidden="true">·</span><a href="https://github.com/yukishidzu/sql-lab" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-medium transition-colors hover:bg-accent hover:text-foreground"><GitHubIcon />GitHub</a></footer>
      <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importBackup(file); event.target.value = '' }} />
    </div>
  )
}
