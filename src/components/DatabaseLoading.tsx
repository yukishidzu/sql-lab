import { Database, Loader2 } from 'lucide-react'
import type { DatabaseOpenProgress } from '../db/client'

export function DatabaseLoading({ progress }: { progress: DatabaseOpenProgress }) {
  return (
    <div className="grid h-full place-items-center bg-background p-5">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground"><Database size={21} /></span>
          <div><h1 className="text-sm font-semibold">Подготавливаем рабочую область</h1><p className="mt-0.5 text-xs text-muted-foreground">PostgreSQL работает прямо в браузере</p></div>
        </div>
        <div className="flex items-center justify-between gap-3 text-xs"><span className="text-muted-foreground">{progress.label}</span><span className="shrink-0 font-mono font-medium">{progress.percent}%</span></div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-label="Загрузка PostgreSQL" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent}>
          <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${progress.percent}%` }} />
        </div>
        <p className="mt-4 flex items-center gap-2 text-[11px] leading-relaxed text-muted-foreground"><Loader2 size={13} className="shrink-0 animate-spin" />Первый запуск дольше: движок и учебные данные сохраняются для следующих посещений.</p>
      </div>
    </div>
  )
}
