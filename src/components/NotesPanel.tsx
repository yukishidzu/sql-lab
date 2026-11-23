import { useState } from 'react'
import { ChevronLeft, ChevronRight, Edit3, Eye } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { SqlTask } from '../types'
import type { TaskCheckResult } from '../lib/tasks'
import { TaskPanel } from './TaskPanel'
import { Button } from './ui/button'
import { Textarea } from './ui/input'

export function NotesPanel({ notes, onChange, tasks, onTasksChange, onCheckTask, collapsed, onToggle }: {
  notes: string
  onChange: (notes: string) => void
  tasks: SqlTask[]
  onTasksChange: (tasks: SqlTask[]) => void
  onCheckTask: (task: SqlTask) => Promise<TaskCheckResult>
  collapsed: boolean
  onToggle: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [tab, setTab] = useState<'notes' | 'tasks'>('notes')
  if (collapsed) return <aside aria-label="Заметки и задания" className="flex h-full w-10 shrink-0 flex-col items-center border-l border-border bg-card py-2"><Button variant="ghost" size="icon" onClick={onToggle} aria-label="Открыть заметки" title="Открыть заметки"><ChevronLeft size={17} /></Button><span className="mt-4 [writing-mode:vertical-rl] text-xs text-muted-foreground">Заметки / Задания</span></aside>
  return (
    <aside aria-label="Заметки и задания" className="flex h-full min-h-0 w-full shrink-0 flex-col border-l border-border bg-card md:w-80 md:max-w-[32vw] xl:w-[340px]">
      <div className="flex h-11 shrink-0 items-center gap-1 border-b border-border px-2">
        <div className="flex min-w-0 gap-1"><Button variant={tab === 'notes' ? 'secondary' : 'ghost'} size="sm" onClick={() => setTab('notes')}>Материалы</Button><Button variant={tab === 'tasks' ? 'secondary' : 'ghost'} size="sm" onClick={() => setTab('tasks')}>Проверка</Button></div>
        <div className="ml-auto flex shrink-0">{tab === 'notes' && <Button variant="ghost" size="icon" className="size-8" onClick={() => setEditing(!editing)} aria-label={editing ? 'Просмотр Markdown' : 'Редактировать заметки'} title={editing ? 'Просмотр' : 'Редактировать'}>{editing ? <Eye size={15} /> : <Edit3 size={15} />}</Button>}<Button variant="ghost" size="icon" className="size-8" onClick={() => { setEditing(false); onToggle() }} aria-label="Свернуть заметки" title="Свернуть"><ChevronRight size={15} /></Button></div>
      </div>
      {tab === 'tasks' ? <TaskPanel tasks={tasks} onChange={onTasksChange} onCheck={onCheckTask} /> : editing ? <Textarea value={notes} onChange={(event) => onChange(event.target.value)} spellCheck={false} className="min-h-0 flex-1 resize-none overflow-auto rounded-none border-0 px-4 py-3 font-mono text-sm leading-relaxed focus:ring-0" aria-label="Markdown-заметки" /> : <div className="markdown min-h-0 flex-1 overflow-auto px-4 py-3 text-sm"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ({ ...props }) => <a {...props} target="_blank" rel="noreferrer" /> }}>{notes}</ReactMarkdown></div>}
    </aside>
  )
}
