import { useRef, useState, type CSSProperties } from 'react'
import { ChevronLeft, ChevronRight, Edit3, Eye } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { SqlTask } from '../types'
import type { TaskCheckResult } from '../lib/tasks'
import { TaskPanel } from './TaskPanel'
import { Button } from './ui/button'
import { Textarea } from './ui/input'

export function NotesPanel({ notes, onChange, tasks, onTasksChange, onCheckTask, currentSql, storageKey, width, onWidthChange, collapsed, onToggle, initialTab = 'notes', activeTab, learnMode = false }: {
  notes: string
  onChange: (notes: string) => void
  tasks: SqlTask[]
  onTasksChange: (tasks: SqlTask[]) => void
  onCheckTask: (task: SqlTask) => Promise<TaskCheckResult>
  currentSql: string
  storageKey: string
  width: number
  onWidthChange: (width: number) => void
  collapsed: boolean
  onToggle: () => void
  initialTab?: 'notes' | 'tasks'
  activeTab?: 'notes' | 'tasks'
  learnMode?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [localTab, setLocalTab] = useState<'notes' | 'tasks'>(initialTab)
  const tab = activeTab ?? localTab
  const setTab = (next: 'notes' | 'tasks') => { if (!activeTab) setLocalTab(next) }
  const resizing = useRef<{ startX: number; startWidth: number } | null>(null)
  const resizeTo = (next: number) => onWidthChange(Math.round(Math.max(280, Math.min(640, window.innerWidth * 0.55, next))))
  if (collapsed) return <aside data-guide="notes" aria-label="Материалы и задания" className="flex h-full w-10 shrink-0 flex-col items-center border-l border-border bg-card py-2"><Button variant="ghost" size="icon" onClick={onToggle} aria-label="Открыть материалы и задания" title="Открыть материалы и задания"><ChevronLeft size={17} /></Button><span className="mt-4 [writing-mode:vertical-rl] text-xs text-muted-foreground">Материалы и задания</span></aside>
  return (
    <aside data-guide="notes" aria-label="Материалы и задания" className="relative flex h-full min-h-0 w-full shrink-0 flex-col border-l border-border bg-card md:w-[var(--notes-width)] md:max-w-[55vw]" style={{ '--notes-width': `${width}px` } as CSSProperties}>
      <div role="separator" aria-orientation="vertical" aria-label="Изменить ширину панели заданий" aria-valuemin={280} aria-valuemax={640} aria-valuenow={width} tabIndex={0} className="absolute bottom-0 left-[-2px] top-0 z-10 hidden w-1 cursor-col-resize bg-border transition-colors hover:bg-primary md:block"
        onPointerDown={(event) => { resizing.current = { startX: event.clientX, startWidth: width }; event.currentTarget.setPointerCapture(event.pointerId) }}
        onPointerMove={(event) => { if (resizing.current) resizeTo(resizing.current.startWidth + resizing.current.startX - event.clientX) }}
        onPointerUp={(event) => { resizing.current = null; event.currentTarget.releasePointerCapture(event.pointerId) }}
        onPointerCancel={() => { resizing.current = null }}
        onKeyDown={(event) => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); resizeTo(width + (event.key === 'ArrowLeft' ? 16 : -16)) } }}
      />
      <div className="hidden h-11 shrink-0 items-center gap-1 border-b border-border px-2 md:flex">
        <div className="flex min-w-0 gap-1"><Button variant={tab === 'notes' ? 'secondary' : 'ghost'} size="sm" onClick={() => setTab('notes')}>Материалы</Button><Button variant={tab === 'tasks' ? 'secondary' : 'ghost'} size="sm" onClick={() => setTab('tasks')}>Задания</Button></div>
        <div className="ml-auto flex shrink-0">{tab === 'notes' && !learnMode && <Button variant="ghost" size="icon" className="size-8" onClick={() => setEditing(!editing)} aria-label={editing ? 'Просмотр Markdown' : 'Редактировать заметки'} title={editing ? 'Просмотр' : 'Редактировать'}>{editing ? <Eye size={15} /> : <Edit3 size={15} />}</Button>}<Button variant="ghost" size="icon" className="hidden size-8 md:inline-flex" onClick={() => { setEditing(false); onToggle() }} aria-label="Свернуть заметки" title="Свернуть"><ChevronRight size={15} /></Button></div>
      </div>
      {tab === 'tasks' ? <TaskPanel tasks={tasks} onChange={onTasksChange} onCheck={onCheckTask} currentSql={currentSql} storageKey={storageKey} learnMode={learnMode} /> : editing && !learnMode ? <Textarea value={notes} onChange={(event) => onChange(event.target.value)} spellCheck={false} className="min-h-0 flex-1 resize-none overflow-auto rounded-none border-0 px-4 py-3 font-mono text-sm leading-relaxed focus:ring-0" aria-label="Markdown-заметки" /> : <div className="markdown min-h-0 flex-1 overflow-auto px-4 py-3 text-sm focus-visible:outline-2 max-md:text-[15px] focus-visible:outline-offset-[-2px] focus-visible:outline-ring" tabIndex={0} aria-label="Материалы по базе данных"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ({ ...props }) => <a {...props} target="_blank" rel="noreferrer" /> }}>{notes}</ReactMarkdown></div>}
    </aside>
  )
}
