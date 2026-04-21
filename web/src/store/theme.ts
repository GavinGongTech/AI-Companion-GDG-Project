import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ThemeStore {
  theme: 'dark' | 'light'
  toggle: () => void
  setTheme: (t: 'dark' | 'light') => void
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: 'dark',
      toggle: () =>
        set((s) => {
          const next = s.theme === 'dark' ? 'light' : 'dark'
          document.documentElement.setAttribute('data-theme', next)
          return { theme: next }
        }),
      setTheme: (theme) => {
        document.documentElement.setAttribute('data-theme', theme)
        set({ theme })
      },
    }),
    { name: 'sf-theme' }
  )
)

// Initialize on page load
if (typeof window !== 'undefined') {
  try {
    const raw = localStorage.getItem('sf-theme')
    const theme = raw ? (JSON.parse(raw)?.state?.theme ?? 'dark') : 'dark'
    document.documentElement.setAttribute('data-theme', theme)
  } catch {
    document.documentElement.setAttribute('data-theme', 'dark')
  }
}
