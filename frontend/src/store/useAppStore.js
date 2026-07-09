import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { detectLanguage, detectRegion } from '../lib/locale'

// UI preferences. Zustand over Context: components subscribe to single
// slices (e.g. only `language`), so a theme flip never re-renders pages
// that only read the language — no provider nesting, trivial persistence.
//
// language/region default to the browser's own locale (see lib/locale.js)
// so a first-time visitor gets Spanish/English and their watch-provider
// country right away — persist middleware then remembers whatever they
// pick manually, and detection never runs again after that.
export const useAppStore = create(
  persist(
    (set) => ({
      language: detectLanguage(), // 'es' | 'en'
      theme: 'light', // 'light' | 'dark' — brief: white mode by default
      region: detectRegion(),
      setLanguage: (language) => set({ language }),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),
      setRegion: (region) => set({ region }),
    }),
    { name: 'cinescope-prefs', version: 1 }
  )
)

// TMDB content locale for the given UI language + watch-provider region.
// Spanish defaults to a Latin American flavor (the region's own "es-XX"
// tag, e.g. es-MX/es-CO) rather than es-ES, since most users detected
// here won't be in Spain; TMDB falls back gracefully to its generic
// Spanish translation for any es-XX without a dedicated one.
export const tmdbLanguage = (language, region) => {
  if (language !== 'es') return 'en-US'
  if (region === 'ES') return 'es-ES'
  return region ? `es-${region}` : 'es-419'
}
