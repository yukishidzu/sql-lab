import { useState } from 'react'
import { ChevronLeft, Edit3, Eye } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from './ui/button'
import { Textarea } from './ui/input'

export function NotesPanel({ notes, onChange, collapsed, onToggle }: {
  notes: string
  onChange: (notes: string) => void
  collapsed: boolean
  onToggle: () => void
}) {
  const [editing, setEditing] = useState(false)
  if (collapsed) return <aside aria-label="Заметки и задания" className="flex h-full w-10 flex-col items-center border-l border-border bg-card py-2"><Button variant="ghost" size="icon" onClick={onToggle} aria-label="Открыть заметки"><ChevronLeft size={17} /></Button><span className="mt-4 [writing-mode:vertical-rl] text-xs text-muted-foreground">Заметки / Задания</span></aside>
  return (
    <aside className="flex h-full min-h-0 flex-col bg-card">
      <div className="flex h-11 items-center border-b border-border px-3"><h2 className="text-sm font-semibold">Заметки / Задания</h2><div className="ml-auto flex"><Button variant="ghost" size="icon" className="size-8" onClick={() => setEditing(!editing)} aria-label={editing ? 'Просмотр Markdown' : 'Редактировать заметки'}>{editing ? <Eye size={15} /> : <Edit3 size={15} />}</Button><Button variant="ghost" size="icon" className="size-8" onClick={onToggle} aria-label="Свернуть заметки"><ChevronLeft size={15} /></Button></div></div>
      {editing ? <Textarea value={notes} onChange={(event) => onChange(event.target.value)} className="min-h-0 flex-1 resize-none rounded-none border-0 font-mono text-xs leading-relaxed focus:ring-0" aria-label="Markdown-заметки" /> : <div className="markdown min-h-0 flex-1 overflow-auto px-4 py-3 text-sm"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ({ ...props }) => <a {...props} target="_blank" rel="noreferrer" /> }}>{notes}</ReactMarkdown></div>}
    </aside>
  )
}
