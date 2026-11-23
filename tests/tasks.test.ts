import { describe, expect, it } from 'vitest'
import { compareTaskResults, tasksFromNotes } from '../src/lib/tasks'
import type { QueryResult } from '../types'

const result = (rows: Record<string, string | number>[], fields = ['id', 'value']): QueryResult => ({
  fields: fields.map((name) => ({ name, dataTypeID: 25 })),
  rows: rows as QueryResult['rows'],
  rowCount: rows.length,
  durationMs: 1,
})

describe('автопроверка заданий', () => {
  it('создаёт задания из Markdown и привязывает эталонные запросы', () => {
    const tasks = tasksFromNotes('## Тема\n\n### 1. Первая задача\nУсловие.\n\n### 2. Вторая задача\nДругое условие.', ['SELECT 1', 'SELECT 2'])
    expect(tasks.map((task) => task.title)).toEqual(['Первая задача', 'Вторая задача'])
    expect(tasks.map((task) => task.referenceQuery)).toEqual(['SELECT 1', 'SELECT 2'])
    expect(tasks[0].prompt).toContain('Условие')
  })

  it('умеет игнорировать или учитывать порядок строк', () => {
    const actual = result([{ id: 2, value: 'b' }, { id: 1, value: 'a' }])
    const expected = result([{ id: 1, value: 'a' }, { id: 2, value: 'b' }])
    expect(compareTaskResults(actual, expected, { compareColumns: false, compareOrder: false, readOnly: true }).status).toBe('passed')
    expect(compareTaskResults(actual, expected, { compareColumns: false, compareOrder: true, readOnly: true }).status).toBe('failed')
  })

  it('проверяет имена колонок только по включённому правилу', () => {
    const actual = result([{ first: 1 }], ['first'])
    const expected = result([{ second: 1 }], ['second'])
    expect(compareTaskResults(actual, expected, { compareColumns: false, compareOrder: false, readOnly: true }).status).toBe('passed')
    expect(compareTaskResults(actual, expected, { compareColumns: true, compareOrder: false, readOnly: true }).status).toBe('failed')
  })

  it('сообщает о разном количестве строк', () => {
    const check = compareTaskResults(result([]), result([{ id: 1, value: 'a' }]), { compareColumns: false, compareOrder: false, readOnly: true })
    expect(check).toMatchObject({ status: 'failed' })
    expect(check.message).toContain('ожидалось 1, получено 0')
  })
})
