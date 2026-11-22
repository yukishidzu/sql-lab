import { useEffect, useRef, useState } from 'react'
import { ArrowRight, BookOpen, Copy, CopyPlus, Database, FilePlus2, Import, Moon, MoreHorizontal, Sun, Trash2 } from 'lucide-react'
import { emptyScenario, presets } from '../data/presets'
import { createWorkspaceRecord, store } from '../lib/store'
import { parseBackup } from '../lib/share'
import { useTheme } from '../lib/theme'
import type { Workspace } from '../types'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'

export function HomePage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [error, setError] = useState('')
  const [quota, setQuota] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const { dark, change } = useTheme()
  const load = async () => setWorkspaces((await store.workspaces.toArray()).sort((a, b) => b.updatedAt - a.updatedAt))
  useEffect(() => {
    void load()
    void navigator.storage?.estimate?.().then((estimate) => { if (estimate.quota) setQuota(`${Math.round(estimate.quota / 1024 / 1024)} МБ доступно локально`) })
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
      <header className="mx-auto flex max-w-6xl items-center px-5 py-5"><div className="flex items-center gap-2 font-semibold"><span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground"><Database size={17} /></span>SQL Lab</div><Badge className="ml-3">PostgreSQL в браузере</Badge><div className="ml-auto flex gap-1"><Button variant="ghost" size="icon" onClick={() => fileRef.current?.click()} aria-label="Импортировать резервную копию"><Import size={17} /></Button><Button variant="ghost" size="icon" onClick={() => change(dark ? 'light' : 'dark')} aria-label="Переключить тему">{dark ? <Sun size={17} /> : <Moon size={17} />}</Button></div></header>
      <main className="mx-auto max-w-6xl px-5 pb-16">
        <section className="grid gap-8 py-10 md:grid-cols-[1.25fr_1fr] md:items-end md:py-16">
          <div><div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-primary"><span className="h-px w-8 bg-primary" />Интерактивная практика SQL</div><h1 className="max-w-2xl text-4xl font-semibold tracking-[-0.035em] text-balance md:text-5xl">Схема перед глазами.<br />Запросы — без установки.</h1><p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">Пишите настоящий PostgreSQL, изучайте связи и данные, сохраняйте запросы и делитесь учебными сценариями. Всё работает локально в браузере.</p></div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm"><div className="mb-3 flex items-center gap-2 text-sm font-medium"><BookOpen size={17} className="text-primary" />Для занятий и самостоятельной работы</div><ul className="space-y-2 text-sm text-muted-foreground"><li>• ERD и SQL на одном экране</li><li>• История и именованные запросы</li><li>• Markdown-задания в каждой ссылке</li><li>• Без сервера и регистрации</li></ul><div className="mt-4 text-xs text-muted-foreground">{quota}</div></div>
        </section>
        {error && <div role="alert" className="mb-5 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        <section><div className="mb-4 flex items-end justify-between"><div><h2 className="text-xl font-semibold">Начать со сценария</h2><p className="mt-1 text-sm text-muted-foreground">Готовые связи, реалистичные данные и шесть текстовых заданий.</p></div><Button variant="outline" onClick={() => void create(emptyScenario())}><FilePlus2 size={15} />Пустая база</Button></div>
          <div className="grid gap-4 md:grid-cols-3">{presets.map((preset) => <button key={preset.id} onClick={() => void create(structuredClone(preset.scenario))} className="group cursor-pointer rounded-xl border border-border bg-card p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"><div className="mb-5 flex items-center justify-between"><span className="grid size-10 place-items-center rounded-lg text-white" style={{ backgroundColor: preset.accent }}><Database size={19} /></span><ArrowRight size={17} className="text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" /></div><h3 className="font-semibold">{preset.name}</h3><p className="mt-2 min-h-16 text-sm leading-relaxed text-muted-foreground">{preset.description}</p><div className="mt-4 text-xs text-muted-foreground">{Object.keys(preset.scenario.data).length} таблиц · 6 заданий</div></button>)}</div>
        </section>
        <section className="mt-12"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-xl font-semibold">Мои рабочие пространства</h2><p className="mt-1 text-sm text-muted-foreground">История доступна по той же ссылке в этом браузере.</p></div><Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}><Import size={14} />Импорт .sqllab.json</Button></div>
          <div className="overflow-hidden rounded-xl border border-border bg-card">{workspaces.map((workspace) => <div key={workspace.id} className="group flex items-center gap-3 border-b border-border/70 px-4 py-3 last:border-0"><button className="min-w-0 flex-1 cursor-pointer text-left" onClick={() => open(workspace.id)}><div className="truncate text-sm font-medium group-hover:text-primary">{workspace.name}</div><div className="mt-1 text-xs text-muted-foreground">Изменено {new Date(workspace.updatedAt).toLocaleString('ru-RU')}</div></button><Button variant="ghost" size="icon" aria-label="Копировать ссылку рабочего пространства" onClick={async () => { await navigator.clipboard.writeText(`${location.origin}${location.pathname}#/w/${workspace.id}`) }}><Copy size={15} /></Button><Button variant="ghost" size="icon" aria-label="Дублировать сценарий" onClick={() => void create({ ...structuredClone(workspace.scenario), name: `${workspace.name} — копия`, notes: workspace.notes })}><CopyPlus size={15} /></Button><Button variant="ghost" size="icon" aria-label="Удалить рабочее пространство" onClick={async () => { if (!confirm(`Удалить «${workspace.name}» и локальную базу? Сначала можно сделать экспорт внутри пространства.`)) return; try { const { deleteWorkspaceDatabase } = await import('../db/client'); await deleteWorkspaceDatabase(workspace.id); await store.workspaces.delete(workspace.id); await store.queries.where('workspaceId').equals(workspace.id).delete(); await store.runs.where('workspaceId').equals(workspace.id).delete(); await load() } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) } }}><Trash2 size={15} /></Button></div>)}{!workspaces.length && <div className="p-10 text-center"><MoreHorizontal className="mx-auto mb-2 text-muted-foreground" /><p className="text-sm text-muted-foreground">Здесь появятся ваши базы после создания.</p></div>}</div>
        </section>
      </main>
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">SQL Lab · настоящий PostgreSQL WASM · данные не покидают устройство</footer>
      <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importBackup(file); event.target.value = '' }} />
    </div>
  )
}
