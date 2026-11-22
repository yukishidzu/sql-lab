import { useCallback, useEffect, useState } from 'react'
import { store } from './store'

export type Theme = 'light' | 'dark' | 'system'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('system')
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches)
  const [resolved, setResolved] = useState(false)
  useEffect(() => {
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
  const change = useCallback((value: Theme) => { setTheme(value); void store.settings.put({ key: 'theme', value }) }, [])
  return { theme, change, resolved, dark }
}
