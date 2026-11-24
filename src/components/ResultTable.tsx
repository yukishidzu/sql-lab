import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Copy, Download } from 'lucide-react'
import type { QueryResult, SqlValue } from '../types'
import { cn, displayValue, downloadFile, formatDuration } from '../lib/utils'
import { Button } from './ui/button'

function csvCell(value: SqlValue) {
  if (value === null) return '\\N'
  let text = displayValue(value)
  if (/^[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}

export function ResultTable({ result, error, running }: { result: QueryResult | null; error: string; running: boolean }) {
  const [page, setPage] = useState(0)
  const [copied, setCopied] = useState(false)
  useEffect(() => { setPage(0) }, [result])
  const allRows = useMemo(() => result?.rowValues ?? result?.rows.map((row) => result.fields.map((field) => row[field.name])) ?? [], [result])
  const pageCount = Math.max(1, Math.ceil(allRows.length / 50))
  const rows = useMemo(() => allRows.slice(page * 50, page * 50 + 50), [allRows, page])
  const csv = useMemo(() => result ? [result.fields.map((field) => csvCell(field.name)).join(','), ...allRows.map((row) => row.map(csvCell).join(','))].join('\n') : '', [result, allRows])

  if (running) return <div className="grid h-full min-h-32 place-items-center text-sm text-muted-foreground"><span className="flex items-center gap-2"><span className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />PostgreSQL выполняет запрос…</span></div>
  if (error) return <div role="alert" className="h-full overflow-auto p-4"><div className="mb-2 text-sm font-medium text-destructive">Запрос не выполнен</div><pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-destructive/90">{error}</pre></div>
  if (!result) return <div className="grid h-full min-h-32 place-items-center p-6 text-center text-sm text-muted-foreground"><div><div className="mb-1 font-medium text-foreground">Результат пока не получен</div>Выполните SQL-запрос, чтобы увидеть строки или сообщение об ошибке</div></div>
  if (!result.fields.length) return <div className="grid h-full min-h-32 place-items-center p-5 text-sm"><div className="flex items-center gap-2 text-green-600 dark:text-green-400"><Check size={18} />Готово{result.affectedRows !== undefined ? ` · затронуто строк: ${result.affectedRows}` : ''}<span className="text-muted-foreground">· {formatDuration(result.durationMs)}</span></div></div>

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-10 flex-wrap items-center gap-2 border-b border-border px-3 py-1 text-xs text-muted-foreground">
        <span>{result.rowCount} {result.rowCount === 1 ? 'строка' : 'строк'} · {formatDuration(result.durationMs)}</span>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={async () => { await navigator.clipboard.writeText(csv); setCopied(true); setTimeout(() => setCopied(false), 1500) }}><Copy size={13} />{copied ? 'Скопировано' : 'CSV'}</Button>
          <Button variant="ghost" size="sm" onClick={() => downloadFile('sql-lab-result.csv', csv, 'text/csv;charset=utf-8')}><Download size={13} />Скачать</Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-left font-mono text-xs max-md:text-sm">
          <thead className="sticky top-0 z-10 bg-secondary/95 backdrop-blur"><tr>{result.fields.map((field, fieldIndex) => <th key={`${field.name}:${fieldIndex}`} className="whitespace-nowrap border-b border-border px-3 py-2 font-medium text-secondary-foreground">{field.name}</th>)}</tr></thead>
          <tbody>{rows.map((values, rowIndex) => <tr key={page * 50 + rowIndex} className="hover:bg-accent/45">{values.map((value, fieldIndex) => <td key={fieldIndex} title={displayValue(value)} className={cn('max-w-72 truncate border-b border-border/60 px-3 py-2', value === null && 'italic text-muted-foreground')}>{displayValue(value)}</td>)}</tr>)}</tbody>
        </table>
        {!rows.length && <div className="p-6 text-center text-sm text-muted-foreground">Запрос выполнен, строк нет.</div>}
      </div>
      {pageCount > 1 && <div className="flex items-center justify-end gap-2 border-t border-border px-3 py-1 text-xs text-muted-foreground"><Button variant="ghost" size="icon" className="size-7" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Предыдущая страница"><ChevronLeft size={15} /></Button>{page + 1} / {pageCount}<Button variant="ghost" size="icon" className="size-7" disabled={page >= pageCount - 1} onClick={() => setPage(page + 1)} aria-label="Следующая страница"><ChevronRight size={15} /></Button></div>}
    </div>
  )
}
