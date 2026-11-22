import type { SqlValue } from '../types'

export function parseCsv(text: string): Record<string, SqlValue>[] {
  const records: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { cell += '"'; index += 1 }
      else if (char === '"') quoted = false
      else cell += char
    } else if (char === '"') quoted = true
    else if (char === ',') { row.push(cell); cell = '' }
    else if (char === '\n') { row.push(cell); records.push(row); row = []; cell = '' }
    else if (char !== '\r') cell += char
  }
  if (cell || row.length) { row.push(cell); records.push(row) }
  if (quoted) throw new Error('Не закрыта кавычка в CSV')
  if (records.length < 2) throw new Error('CSV должен содержать заголовки и хотя бы одну строку')
  const headers = records[0]
  if (new Set(headers).size !== headers.length || headers.some((header) => !header)) throw new Error('Пустые или повторяющиеся заголовки CSV')
  return records.slice(1).filter((record) => record.some((value) => value !== '')).map((record) => {
    if (record.length !== headers.length) throw new Error('Разное число колонок в строках CSV')
    return Object.fromEntries(headers.map((header, index) => [header, record[index] === '' ? null : record[index]]))
  })
}

export function parseDataImport(text: string, extension: string) {
  if (extension === 'json') {
    const value: unknown = JSON.parse(text)
    if (!Array.isArray(value) || value.some((row) => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error('JSON должен быть массивом объектов')
    return value as Record<string, SqlValue>[]
  }
  return parseCsv(text)
}
