import { describe, expect, it } from 'vitest'
import { typedValue } from '../src/components/DataDrawer'

describe('ввод значений строки', () => {
  it('различает SQL NULL и текст NULL', () => {
    expect(typedValue('NULL', 'text')).toBeNull()
    expect(typedValue('null', 'integer')).toBeNull()
    expect(typedValue("'NULL'", 'text')).toBe('NULL')
    expect(typedValue("'null'", 'text')).toBe('null')
  })
  it('отклоняет неизвестный boolean вместо незаметной записи false', () => {
    expect(typedValue('false', 'boolean')).toBe(false)
    expect(typedValue('t', 'boolean')).toBe(true)
    expect(() => typedValue('abc', 'boolean')).toThrow('boolean')
  })
  it('не превращает пустое число в ноль', () => {
    expect(typedValue('', 'integer')).toBe('')
    expect(typedValue('', 'text')).toBe('')
  })
})
