import { useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronRight, Edit3, Loader2, Plus, Trash2, XCircle } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { SqlTask } from '../types'
import { defaultTaskRules, type TaskCheckResult } from '../lib/tasks'
import { Button } from './ui/button'
import { Dialog, DialogContent } from './ui/dialog'
import { Input, Textarea } from './ui/input'
import { Badge } from './ui/badge'

const emptyTask = (): SqlTask => ({
  id: crypto.randomUUID(),
  title: '',
  prompt: '',
  referenceQuery: '',
  rules: { ...defaultTaskRules },
})

type StoredTaskResult = { result: TaskCheckResult; signature: string; completed: boolean }

export function TaskPanel({ tasks, onChange, onCheck, currentSql, storageKey }: {
  tasks: SqlTask[]
  onChange: (tasks: SqlTask[]) => void
  onCheck: (task: SqlTask) => Promise<TaskCheckResult>
  currentSql: string
  storageKey: string
}) {
  const [selectedId, setSelectedId] = useState<string | null>(tasks[0]?.id ?? null)
  const [editingTask, setEditingTask] = useState<SqlTask | null>(null)
  const [checkingId, setCheckingId] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, StoredTaskResult>>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) ?? '{}') as Record<string, StoredTaskResult> } catch { return {} }
  })
  const [formError, setFormError] = useState('')

  const check = async (task: SqlTask) => {
    setCheckingId(task.id)
    const signature = JSON.stringify([currentSql, task.referenceQuery, task.rules])
    const result = await onCheck(task)
    setResults((current) => {
      const next = { ...current, [task.id]: { result, signature, completed: current[task.id]?.completed || result.status === 'passed' } }
      try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch {}
      return next
    })
    setCheckingId(null)
  }
  const save = () => {
    if (!editingTask) return
    if (!editingTask.title.trim() || !editingTask.prompt.trim() || !editingTask.referenceQuery.trim()) {
      setFormError('Заполните название, условие и эталонный запрос.')
      return
    }
    const exists = tasks.some((task) => task.id === editingTask.id)
    onChange(exists ? tasks.map((task) => task.id === editingTask.id ? editingTask : task) : [...tasks, editingTask])
    setSelectedId(editingTask.id)
    setEditingTask(null)
    setFormError('')
  }
  const remove = () => {
    if (!editingTask || !confirm('Удалить это задание и правила его проверки?')) return
    onChange(tasks.filter((task) => task.id !== editingTask.id))
    if (selectedId === editingTask.id) setSelectedId(null)
    setEditingTask(null)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {!tasks.length && <div className="px-3 py-8 text-center text-sm text-muted-foreground">Добавьте первое задание и эталонный запрос для его проверки.</div>}
        {tasks.map((task, index) => {
          const selected = selectedId === task.id
          const stored = results[task.id]
          const completed = Boolean(stored?.completed || stored?.result.status === 'passed')
          const currentResult = stored?.signature === JSON.stringify([currentSql, task.referenceQuery, task.rules]) ? stored.result : undefined
          const result = currentResult ?? (completed ? { status: 'passed' as const, message: 'Задание зачтено. Изменение текущего запроса не отменяет этот результат.' } : undefined)
          return <section key={task.id} className="mb-1 overflow-hidden rounded-lg border border-border/70">
            <div className="flex items-center bg-secondary/35">
              <button className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 px-2.5 py-2 text-left text-xs font-medium hover:bg-accent" onClick={() => setSelectedId(selected ? null : task.id)} aria-expanded={selected}>
                {selected ? <ChevronDown size={14} className="shrink-0" /> : <ChevronRight size={14} className="shrink-0" />}
                <span className="truncate">{index + 1}. {task.title}</span>
                {completed && <CheckCircle2 size={14} className="ml-auto shrink-0 text-green-600" />}
              </button>
              <Button variant="ghost" size="icon" className="mr-1 size-7" aria-label={`Редактировать задание ${index + 1}`} onClick={() => { setEditingTask(structuredClone(task)); setFormError('') }}><Edit3 size={13} /></Button>
            </div>
            {selected && <div className="border-t border-border/70 p-3">
              <div className="markdown text-xs"><ReactMarkdown remarkPlugins={[remarkGfm]}>{task.prompt}</ReactMarkdown></div>
              <div className="mt-3 flex flex-wrap gap-1"><Badge>{task.rules.compareOrder ? 'Порядок важен' : 'Любой порядок'}</Badge><Badge>{task.rules.compareColumns ? 'Имена колонок' : 'Любые алиасы'}</Badge></div>
              <Button size="sm" className="mt-3 w-full" disabled={checkingId !== null} onClick={() => void check(task)}>
                {checkingId === task.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}Проверить решение
              </Button>
              {result && <div role="status" className={`mt-2 flex items-start gap-2 rounded-md p-2 text-xs ${result.status === 'passed' ? 'bg-green-500/10 text-green-700 dark:text-green-300' : 'bg-destructive/10 text-destructive'}`}>
                {result.status === 'passed' ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> : <XCircle size={15} className="mt-0.5 shrink-0" />}<span>{result.message}</span>
              </div>}
            </div>}
          </section>
        })}
      </div>
      <div className="shrink-0 border-t border-border p-2"><Button variant="outline" size="sm" className="w-full" onClick={() => { setEditingTask(emptyTask()); setFormError('') }}><Plus size={14} />Новое задание</Button></div>
      <Dialog open={editingTask !== null} onOpenChange={(open) => { if (!open) setEditingTask(null) }}>
        <DialogContent title={tasks.some((task) => task.id === editingTask?.id) ? 'Редактирование задания' : 'Новое задание'} description="Эталонный запрос выполняется в той же базе и не показывается в условии.">
          {editingTask && <div className="space-y-3">
            <label className="block text-xs font-medium">Название<Input className="mt-1" value={editingTask.title} onChange={(event) => setEditingTask({ ...editingTask, title: event.target.value })} aria-label="Название задания" /></label>
            <label className="block text-xs font-medium">Условие в Markdown<Textarea className="mt-1 min-h-28 resize-y" value={editingTask.prompt} onChange={(event) => setEditingTask({ ...editingTask, prompt: event.target.value })} aria-label="Условие задания" /></label>
            <label className="block text-xs font-medium">Эталонный SQL<Textarea className="mt-1 min-h-32 resize-y font-mono text-xs" spellCheck={false} value={editingTask.referenceQuery} onChange={(event) => setEditingTask({ ...editingTask, referenceQuery: event.target.value })} aria-label="Эталонный SQL" /></label>
            <fieldset className="space-y-2 rounded-lg border border-border p-3"><legend className="px-1 text-xs font-medium">Правила приёма</legend>
              {([
                ['compareColumns', 'Сравнивать названия и порядок колонок'],
                ['compareOrder', 'Требовать точный порядок строк'],
                ['readOnly', 'Разрешить только SELECT и WITH'],
              ] as const).map(([key, label]) => <label key={key} className="flex cursor-pointer items-center gap-2 text-xs"><input type="checkbox" checked={editingTask.rules[key]} onChange={(event) => setEditingTask({ ...editingTask, rules: { ...editingTask.rules, [key]: event.target.checked } })} />{label}</label>)}
            </fieldset>
            {formError && <p role="alert" className="text-xs text-destructive">{formError}</p>}
            <div className="flex items-center gap-2"><Button onClick={save}>Сохранить задание</Button><Button variant="outline" onClick={() => setEditingTask(null)}>Отмена</Button>{tasks.some((task) => task.id === editingTask.id) && <Button variant="ghost" size="icon" className="ml-auto text-destructive" aria-label="Удалить задание" onClick={remove}><Trash2 size={15} /></Button>}</div>
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  )
}
