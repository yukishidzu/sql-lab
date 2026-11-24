import { useCallback, useEffect, useState } from 'react'
import { store } from './store'

export type Theme = 'light' | 'dark' | 'system'

function localTheme(): Theme | null {
  try {
    const value = localStorage.getItem('sql-lab-theme')
    return value === 'light' || value === 'dark' || value === 'system' ? value : null
  } catch { return null }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => localTheme() ?? 'system')
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches)
  const [resolved, setResolved] = useState(false)
  useEffect(() => {
    const local = localTheme()
    if (local) { setResolved(true); return }
    void store.settings.get('theme').then((entry) => { if (entry?.value === 'light' || entry?.value === 'dark' || entry?.value === 'system') setTheme(entry.value); setResolved(true) })
  }, [])
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)')
    const update = () => setSystemDark(media.matches)
    update(); media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  const dark = theme === 'dark' || (theme === 'system' && systemDark)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  }, [dark])
  const change = useCallback((value: Theme) => {
    setTheme(value)
    try { localStorage.setItem('sql-lab-theme', value) } catch {}
    void store.settings.put({ key: 'theme', value })
  }, [])
  return { theme, change, resolved, dark }
}
