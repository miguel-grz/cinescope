import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// UI preferences. Zustand over Context: components subscribe to single
// slices (e.g. only `language`), so a theme flip never re-renders pages
// that only read the language — no provider nesting, trivial persistence.
export const useAppStore = create(
  persist(
    (set) => ({
      language: 'es', // 'es' | 'en'
      theme: 'light', // 'light' | 'dark' — brief: white mode by default
      region: 'CO',
      setLanguage: (language) => set({ language }),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),
      setRegion: (region) => set({ region }),
    }),
    { name: 'cinescope-prefs', version: 1 }
  )
)

export const tmdbLanguage = (language) => (language === 'es' ? 'es-ES' : 'en-US')
