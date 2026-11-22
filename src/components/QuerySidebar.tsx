import { useState } from 'react'
import { Clock3, Code2, History, Pencil, Trash2 } from 'lucide-react'
import type { QueryRun, SavedQuery } from '../types'
import { displayValue, formatDuration } from '../lib/utils'
import { Button } from './ui/button'
import { Input } from './ui/input'

export function QuerySidebar({ queries, runs, onOpen, onRename, onDelete, onClose }: {
  queries: SavedQuery[]
  runs: QueryRun[]
  onOpen: (sql: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<'saved' | 'history'>('saved')
  const [editing, setEditing] = useState<string | null>(null)
  const [name, setName] = useState('')
  return (
    <aside className="flex h-full min-h-0 flex-col bg-card">
      <div className="flex h-11 items-center gap-1 border-b border-border px-2">
        <Button variant={tab === 'saved' ? 'secondary' : 'ghost'} size="sm" onClick={() => setTab('saved')}><Code2 size={14} />Запросы</Button>
        <Button variant={tab === 'history' ? 'secondary' : 'ghost'} size="sm" onClick={() => setTab('history')}><History size={14} />История</Button>
        <Button variant="ghost" size="icon" className="ml-auto size-8" onClick={onClose} aria-label="Закрыть панель">×</Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {tab === 'saved' && <div className="space-y-1">{queries.map((query) => <div key={query.id} className="group rounded-lg border border-transparent p-2 hover:border-border hover:bg-accent/40">
          {editing === query.id ? <form onSubmit={(event) => { event.preventDefault(); onRename(query.id, name); setEditing(null) }} className="flex gap-1"><Input autoFocus value={name} onChange={(event) => setName(event.target.value)} className="h-8" /><Button size="sm" type="submit">ОК</Button></form> : <>
            <button className="w-full cursor-pointer text-left" onClick={() => onOpen(query.sql)}><div className="truncate text-sm font-medium">{query.name}</div><div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{query.sql}</div></button>
            <div className="mt-1 flex justify-end gap-1 opacity-60 group-hover:opacity-100"><Button variant="ghost" size="icon" className="size-6" onClick={() => { setEditing(query.id); setName(query.name) }} aria-label="Переименовать"><Pencil size={12} /></Button><Button variant="ghost" size="icon" className="size-6" onClick={() => onDelete(query.id)} aria-label="Удалить"><Trash2 size={12} /></Button></div>
          </>}
        </div>)}{!queries.length && <Empty text="Сохраните запрос кнопкой над редактором" />}</div>}
        {tab === 'history' && <div className="space-y-1">{runs.map((run) => <button key={run.id} className="w-full cursor-pointer rounded-lg p-2 text-left hover:bg-accent/50" onClick={() => onOpen(run.sql)}><div className="flex items-center gap-2 text-xs"><span className={run.status === 'success' ? 'size-2 rounded-full bg-green-500' : 'size-2 rounded-full bg-destructive'} /><span className="text-muted-foreground">{new Date(run.createdAt).toLocaleString('ru-RU')}</span><span className="ml-auto text-muted-foreground">{formatDuration(run.durationMs)}</span></div><div className="mt-1 line-clamp-2 font-mono text-[11px]">{run.sql}</div>{run.error && <div className="mt-1 truncate text-[11px] text-destructive">{displayValue(run.error)}</div>}</button>)}{!runs.length && <Empty text="Запуски появятся после первого SQL-запроса" />}</div>}
      </div>
    </aside>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="px-3 py-10 text-center text-xs leading-relaxed text-muted-foreground"><Clock3 className="mx-auto mb-2 opacity-50" size={20} />{text}</div>
}
