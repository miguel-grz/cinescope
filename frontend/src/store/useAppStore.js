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
//
// This is NOT just "es" + region: TMDB's per-country Spanish translations
// are contributed unevenly. Verified against the live API — a title like
// Moana has a dedicated es-MX translation ("Moana") but no es-CO/es-AR/
// es-419 entry, so those all silently fall back to the generic Spanish
// pool (historically Spain-sourced, "Vaiana"). es-MX is consistently the
// most complete Latin American Spanish pool (checked "Your Name." → only
// es-MX has "Tu nombre"; never worse than the generic pool in any title
// tested), so it's the de facto standard for "Latin American Spanish"
// content here — independent of the user's exact country, which is kept
// separate and exact for watch-provider availability (see `region`).
export const tmdbLanguage = (language, region) =>
  language === 'es' ? (region === 'ES' ? 'es-ES' : 'es-MX') : 'en-US'
