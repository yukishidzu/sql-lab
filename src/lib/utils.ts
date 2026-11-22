import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`
}

export function formatDuration(ms: number) {
  return ms < 1000 ? `${Math.round(ms)} мс` : `${(ms / 1000).toFixed(2)} с`
}

export function downloadFile(name: string, content: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(url)
}

export function displayValue(value: unknown) {
  if (value === null) return 'NULL'
  if (value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Uint8Array) return `\\x${Array.from(value, (byte) => byte.toString(16).padStart(2, '0')).join('')}`
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
