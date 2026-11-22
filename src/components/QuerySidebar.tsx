import { useState } from 'react'
import { Clock3, Code2, History, Pencil, Trash2 } from 'lucide-react'
import type { QueryRun, SavedQuery } from '../types'
import { displayValue, formatDuration } from '../lib/utils'
import { Button } from './ui/button'

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
  const finishRename = (query: SavedQuery) => {
    if (name.trim() && name.trim() !== query.name) onRename(query.id, name.trim())
    setEditing(null)
  }
  return (
    <aside className="flex h-full min-h-0 flex-col bg-card">
      <div className="flex h-11 items-center gap-1 border-b border-border px-2">
        <Button variant={tab === 'saved' ? 'secondary' : 'ghost'} size="sm" onClick={() => setTab('saved')}><Code2 size={14} />Запросы</Button>
        <Button variant={tab === 'history' ? 'secondary' : 'ghost'} size="sm" onClick={() => setTab('history')}><History size={14} />История</Button>
        <Button variant="ghost" size="icon" className="ml-auto size-8" onClick={onClose} aria-label="Закрыть панель">×</Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {tab === 'saved' && <div className="space-y-1">{queries.map((query) => <div key={query.id} data-query-card className="group rounded-lg border border-transparent p-2 hover:border-border hover:bg-accent/40">
          {editing === query.id ? <input
            autoFocus
            aria-label="Название запроса"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onFocus={(event) => event.target.select()}
            onBlur={() => finishRename(query)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
              if (event.key === 'Escape') { setName(query.name); setEditing(null) }
            }}
            className="block h-5 w-full rounded bg-accent/60 px-1 text-sm font-medium outline-none ring-1 ring-primary/40"
          /> : <button className="block h-5 w-full cursor-pointer truncate text-left text-sm font-medium" onClick={() => onOpen(query.sql)}>{query.name}</button>}
          <button className="mt-1 block w-full cursor-pointer truncate text-left font-mono text-[11px] text-muted-foreground" onClick={() => onOpen(query.sql)}>{query.sql}</button>
          <div className="mt-1 flex h-6 justify-end gap-1 opacity-60 group-hover:opacity-100"><Button variant="ghost" size="icon" className="size-6" onClick={() => { if (editing === query.id) finishRename(query); else { setEditing(query.id); setName(query.name) } }} aria-label="Переименовать"><Pencil size={12} /></Button><Button variant="ghost" size="icon" className="size-6" onClick={() => onDelete(query.id)} aria-label="Удалить"><Trash2 size={12} /></Button></div>
        </div>)}{!queries.length && <Empty text="Сохраните запрос кнопкой над редактором" />}</div>}
        {tab === 'history' && <div className="space-y-1">{runs.map((run) => <button key={run.id} className="w-full cursor-pointer rounded-lg p-2 text-left hover:bg-accent/50" onClick={() => onOpen(run.sql)}><div className="flex items-center gap-2 text-xs"><span className={run.status === 'success' ? 'size-2 rounded-full bg-green-500' : 'size-2 rounded-full bg-destructive'} /><span className="text-muted-foreground">{new Date(run.createdAt).toLocaleString('ru-RU')}</span><span className="ml-auto text-muted-foreground">{formatDuration(run.durationMs)}</span></div><div className="mt-1 line-clamp-2 font-mono text-[11px]">{run.sql}</div>{run.error && <div className="mt-1 truncate text-[11px] text-destructive">{displayValue(run.error)}</div>}</button>)}{!runs.length && <Empty text="Запуски появятся после первого SQL-запроса" />}</div>}
      </div>
    </aside>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="px-3 py-10 text-center text-xs leading-relaxed text-muted-foreground"><Clock3 className="mx-auto mb-2 opacity-50" size={20} />{text}</div>
}
