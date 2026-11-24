import { describe, expect, it } from 'vitest'
import { parseCsv, parseDataImport } from '../src/lib/csv'

describe('импорт данных', () => {
  it('читает кавычки, запятые и NULL', () => {
    expect(parseCsv('id,name,comment\n1,"Иван, Иванов","said ""hello"""\n2,Без комментария,\\N')).toEqual([
      { id: '1', name: 'Иван, Иванов', comment: 'said "hello"' },
      { id: '2', name: 'Без комментария', comment: null },
    ])
  })
  it('различает пустую строку и NULL', () => {
    expect(parseCsv('id,empty,missing\n1,,\\N')).toEqual([{ id: '1', empty: '', missing: null }])
  })
  it('отклоняет повреждённые файлы', () => {
    expect(() => parseCsv('id,name\n1,"broken')).toThrow('Не закрыта кавычка')
    expect(() => parseCsv('id,id\n1,2')).toThrow('Пустые или повторяющиеся')
    expect(() => parseDataImport('{}', 'json')).toThrow('массивом объектов')
  })
})
