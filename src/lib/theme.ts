import { useCallback, useEffect, useState } from 'react'
import { store } from './store'

export type Theme = 'light' | 'dark' | 'system'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('system')
  const [resolved, setResolved] = useState(false)
  useEffect(() => {
    void store.settings.get('theme').then((entry) => { if (entry?.value === 'light' || entry?.value === 'dark' || entry?.value === 'system') setTheme(entry.value); setResolved(true) })
  }, [])
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches)
      document.documentElement.classList.toggle('dark', dark)
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
    }
    apply(); media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])
  const change = useCallback((value: Theme) => { setTheme(value); void store.settings.put({ key: 'theme', value }) }, [])
  return { theme, change, resolved, dark: theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches) }
}
