import { describe, expect, it } from 'vitest'
import { typedValue } from '../src/components/DataDrawer'

describe('ввод значений строки', () => {
  it('различает SQL NULL и текст NULL', () => {
    expect(typedValue('NULL', 'text')).toBeNull()
    expect(typedValue('null', 'integer')).toBeNull()
    expect(typedValue("'NULL'", 'text')).toBe('NULL')
    expect(typedValue("'null'", 'text')).toBe('null')
  })
  it('не превращает пустое число в ноль', () => {
    expect(typedValue('', 'integer')).toBe('')
    expect(typedValue('', 'text')).toBe('')
  })
})
