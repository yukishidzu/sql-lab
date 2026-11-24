import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { ArrowLeft, ArrowLeftRight, ArrowRight, Check, CircleHelp, Download, EyeOff, LayoutGrid, Link2, List, Map, Minus, Moon, Plus, Scan, X } from 'lucide-react'
import { Button } from './ui/button'

function GuideIcon({ children }: { children: ReactNode }) {
  return <span className="mx-0.5 inline-flex size-6 translate-y-[-2px] items-center justify-center rounded-md border border-border bg-secondary align-middle text-foreground">{children}</span>
}

type GuideStep = { selector: string; additionalSelectors?: string[]; title: string; text: ReactNode; mobileTab?: 'schema' | 'sql' | 'materials' | 'tasks' }

const guideSteps: GuideStep[] = [
  { selector: '[data-guide="sql-editor"]', mobileTab: 'sql', title: 'SQL-редактор и запуск', text: 'Пишите запросы здесь — автодополнение подскажет команды, таблицы и колонки. Запускайте через «Выполнить» (Ctrl/Cmd + Enter), сохраняйте через Ctrl/Cmd + S. Результат и ошибки появятся ниже.' },
  { selector: '[data-guide="schema"]', mobileTab: 'schema', title: 'Интерактивная схема', text: 'Клик по таблице открывает её данные, клик по колонке вставляет имя прямо в редактор, а наведение на линию подсвечивает связь. Сущности можно свободно перетаскивать, а всю схему — масштабировать.' },
  { selector: '[data-guide="schema-controls"]', mobileTab: 'schema', additionalSelectors: ['.react-flow__controls', '.react-flow__minimap'], title: 'Управление схемой', text: <><GuideIcon><List size={13} /></GuideIcon> — дерево таблиц, <GuideIcon><LayoutGrid size={13} /></GuideIcon> — автораскладка, <GuideIcon><EyeOff size={13} /></GuideIcon> — скрытие схемы. <GuideIcon><Plus size={13} /></GuideIcon> и <GuideIcon><Minus size={13} /></GuideIcon> — масштаб, <GuideIcon><Scan size={13} /></GuideIcon> — вся схема, <GuideIcon><Map size={13} /></GuideIcon> — мини-карта.</> },
  { selector: '[data-guide="swap-panels"]', additionalSelectors: ['[data-guide="hide-result"]', '[data-guide="hide-schema"]', '[role="separator"]'], title: 'Настройка экрана', text: <><GuideIcon><ArrowLeftRight size={13} /></GuideIcon> меняет SQL и схему местами, <GuideIcon><EyeOff size={13} /></GuideIcon> скрывает результат или схему. Тяните разделители между блоками, чтобы менять их размеры.</> },
  { selector: '[data-guide="queries"]', title: 'Запросы и история', text: 'Все сохранённые запросы и история запусков собраны здесь — можно подписывать удачные решения и возвращаться к прошлым вариантам.' },
  { selector: '[data-guide="notes"]', mobileTab: 'materials', title: 'Материалы и задания', text: 'В «Материалах» находятся описание базы и таблиц, а во вкладке «Задания» — условия и проверка SQL.' },
  { selector: '[data-guide="workspace-actions"]', title: 'Сценарий, ссылка и помощь', text: <>В «Сценарии» вы правите DDL и создаёте таблицы. <GuideIcon><Link2 size={13} /></GuideIcon> и <GuideIcon><Download size={13} /></GuideIcon> помогают поделиться базой или сохранить копию. <GuideIcon><Moon size={13} /></GuideIcon> переключает тему, а <GuideIcon><CircleHelp size={13} /></GuideIcon> снова открывает этот гайд.</> },
]

type Rect = { left: number; top: number; width: number; height: number; subtle: boolean }

const selectorsFor = (step: GuideStep) => [step.selector, ...(step.additionalSelectors ?? [])]
const isVisible = (selector: string) => {
  const rect = document.querySelector(selector)?.getBoundingClientRect()
  return Boolean(rect && rect.width > 0 && rect.height > 0)
}

export function InterfaceGuide({ onClose, mobile = false, onStepChange, onCardResize }: { onClose: () => void; mobile?: boolean; onStepChange?: (tab: 'schema' | 'sql' | 'materials' | 'tasks') => void; onCardResize?: (height: number) => void }) {
  const [steps] = useState(() => guideSteps.filter((step) => selectorsFor(step).some(isVisible) || (mobile && step.mobileTab)))
  const [stepIndex, setStepIndex] = useState(0)
  const [targets, setTargets] = useState<Rect[]>([])
  const [cardStyle, setCardStyle] = useState<CSSProperties>({})
  const cardRef = useRef<HTMLDivElement>(null)
  const step = steps[stepIndex]
  const target = targets[0]

  const updateTarget = useCallback(() => {
    if (!step) return
    const next = selectorsFor(step).flatMap((selector) => [...document.querySelectorAll(selector)].flatMap((element) => {
      const rect = element.getBoundingClientRect()
      const subtle = element.matches('[role="separator"]')
      const padding = subtle ? 1 : 5
      return rect.width > 0 && rect.height > 0 ? [{
        left: rect.left - padding,
        top: rect.top - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
        subtle,
      }] : []
    }))
    setTargets(next)
  }, [step])

  useEffect(() => {
    if (!mobile || !onCardResize || !cardRef.current) return
    const observer = new ResizeObserver(([entry]) => onCardResize(entry.contentRect.height))
    observer.observe(cardRef.current)
    return () => observer.disconnect()
  }, [mobile, onCardResize])

  useEffect(() => {
    if (step?.mobileTab) onStepChange?.(step.mobileTab)
  }, [step, onStepChange])

  useLayoutEffect(() => {
    updateTarget()
    const elements = step ? selectorsFor(step).flatMap((selector) => [...document.querySelectorAll(selector)]) : []
    const observer = elements.length ? new ResizeObserver(updateTarget) : null
    elements.forEach((element) => observer?.observe(element))
    window.addEventListener('resize', updateTarget)
    window.addEventListener('scroll', updateTarget, true)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', updateTarget)
      window.removeEventListener('scroll', updateTarget, true)
    }
  }, [step, updateTarget])

  useLayoutEffect(() => {
    if (!target || !cardRef.current) return
    const card = cardRef.current.getBoundingClientRect()
    if (window.innerWidth < 640) {
      setCardStyle({ left: 12, right: 12, bottom: 12, top: 'auto' })
      return
    }
    const clampLeft = (left: number) => Math.max(12, Math.min(left, window.innerWidth - card.width - 12))
    const clampTop = (top: number) => Math.max(12, Math.min(top, window.innerHeight - card.height - 12))
    const candidates = [
      { left: target.left + target.width + 16, top: clampTop(target.top) },
      { left: target.left - card.width - 16, top: clampTop(target.top) },
      { left: clampLeft(target.left), top: target.top + target.height + 16 },
      { left: clampLeft(target.left), top: target.top - card.height - 16 },
    ]
    const overlap = (candidate: { left: number; top: number }) => {
      const width = Math.max(0, Math.min(candidate.left + card.width, target.left + target.width) - Math.max(candidate.left, target.left))
      const height = Math.max(0, Math.min(candidate.top + card.height, target.top + target.height) - Math.max(candidate.top, target.top))
      return width * height
    }
    const withinViewport = (candidate: { left: number; top: number }) => candidate.left >= 12 && candidate.top >= 12
      && candidate.left + card.width <= window.innerWidth - 12 && candidate.top + card.height <= window.innerHeight - 12
    const position = candidates.find((candidate) => withinViewport(candidate) && overlap(candidate) === 0)
      ?? candidates.map((candidate) => ({ left: clampLeft(candidate.left), top: clampTop(candidate.top) })).sort((a, b) => overlap(a) - overlap(b))[0]
    setCardStyle({ left: position.left, top: position.top, right: 'auto', bottom: 'auto' })
  }, [target, stepIndex])

  useEffect(() => {
    cardRef.current?.querySelector<HTMLButtonElement>('[data-guide-next]')?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight' && stepIndex < steps.length - 1) setStepIndex((index) => index + 1)
      if (event.key === 'ArrowLeft' && stepIndex > 0) setStepIndex((index) => index - 1)
      if (event.key === 'Tab' && cardRef.current) {
        const buttons = [...cardRef.current.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
        const first = buttons[0]
        const last = buttons.at(-1)
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, stepIndex, steps.length])

  if (!step) return null
  const last = stepIndex === steps.length - 1
  return (
    <div className="fixed inset-0 z-[70]">
      {targets.length > 0 && <svg className="pointer-events-none fixed inset-0 size-full">
        <defs><mask id="interface-guide-mask" maskUnits="userSpaceOnUse"><rect width="100%" height="100%" fill="white" />{targets.filter((rect) => !rect.subtle).map((rect, index) => <rect key={index} x={rect.left} y={rect.top} width={rect.width} height={rect.height} rx="8" fill="black" />)}</mask></defs>
        <rect width="100%" height="100%" fill="rgba(0, 0, 0, 0.58)" mask="url(#interface-guide-mask)" />
        {targets.filter((rect) => rect.subtle).map((rect, index) => <rect key={index} x={rect.left} y={rect.top} width={rect.width} height={rect.height} rx="2" fill="var(--primary)" opacity="0.42" />)}
        {targets.filter((rect) => !rect.subtle).map((rect, index) => <rect key={index} x={rect.left} y={rect.top} width={rect.width} height={rect.height} rx="8" fill="none" stroke="var(--primary)" strokeWidth="2" />)}
      </svg>}
      <div ref={cardRef} role="dialog" aria-modal="true" aria-labelledby="interface-guide-title" className="fixed w-[calc(100%-1.5rem)] max-w-sm rounded-xl border border-border bg-card p-4 text-card-foreground shadow-2xl" style={cardStyle}>
        <div className="flex items-center gap-2"><span className="text-xs font-medium text-muted-foreground">{stepIndex + 1} / {steps.length}</span><div className="h-1 flex-1 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(stepIndex + 1) / steps.length * 100}%` }} /></div><Button variant="ghost" size="icon" className="size-7" onClick={onClose} aria-label="Закрыть гайд"><X size={15} /></Button></div>
        <h2 id="interface-guide-title" className="mt-3 text-base font-semibold">{step.title}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground max-md:text-[15px]">{step.text}</p>
        <div className="mt-4 flex items-center justify-between gap-2">{!last && <Button variant="ghost" size="sm" onClick={onClose}>Пропустить</Button>}<div className="ml-auto flex gap-2">{stepIndex > 0 && <Button variant="outline" size="sm" onClick={() => setStepIndex((index) => index - 1)}><ArrowLeft size={14} />Назад</Button>}<Button size="sm" data-guide-next onClick={() => { if (last) onClose(); else setStepIndex((index) => index + 1) }}>{last ? 'Начать работу' : 'Далее'}{last ? <Check size={14} /> : <ArrowRight size={14} />}</Button></div></div>
      </div>
    </div>
  )
}
