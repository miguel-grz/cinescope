import { lazy, Suspense, useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { NavBar } from './components/NavBar'
import { Home } from './pages/Home'
import { useAppStore } from './store/useAppStore'
import { useAuthStore } from './store/useAuthStore'
import { useLibraryStore } from './store/useLibraryStore'
import { useT } from './i18n/translations'

// Route-level code splitting: detail/library pages load on demand.
const Search = lazy(() => import('./pages/Search').then((m) => ({ default: m.Search })))
const Discover = lazy(() => import('./pages/Discover').then((m) => ({ default: m.Discover })))
const MovieDetail = lazy(() => import('./pages/MovieDetail').then((m) => ({ default: m.MovieDetail })))
const TvDetail = lazy(() => import('./pages/TvDetail').then((m) => ({ default: m.TvDetail })))
const PersonDetail = lazy(() => import('./pages/PersonDetail').then((m) => ({ default: m.PersonDetail })))
const Watched = lazy(() => import('./pages/Watched').then((m) => ({ default: m.Watched })))
const Library = lazy(() => import('./pages/Library').then((m) => ({ default: m.Library })))
const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })))
const Register = lazy(() => import('./pages/Register').then((m) => ({ default: m.Register })))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => window.scrollTo({ top: 0 }), [pathname])
  return null
}

function Fallback() {
  const t = useT()
  return <div className="flex min-h-[50vh] items-center justify-center pt-14 text-ink-dim">{t('loading')}</div>
}

export default function App() {
  const theme = useAppStore((s) => s.theme)
  const language = useAppStore((s) => s.language)
  const checkSession = useAuthStore((s) => s.checkSession)
  const user = useAuthStore((s) => s.user)
  const loadLibrary = useLibraryStore((s) => s.load)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  useEffect(() => {
    checkSession()
  }, [checkSession])

  useEffect(() => {
    if (user) loadLibrary()
    else useLibraryStore.getState().clear()
  }, [user, loadLibrary])

  return (
    <>
      <ScrollToTop />
      <NavBar />
      <main>
        <Suspense fallback={<Fallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<Search />} />
            <Route path="/movies" element={<Discover mediaType="movie" key="movie" />} />
            <Route path="/tv" element={<Discover mediaType="tv" key="tv" />} />
            <Route path="/movie/:id" element={<MovieDetail />} />
            <Route path="/tv/:id" element={<TvDetail />} />
            <Route path="/person/:id" element={<PersonDetail />} />
            <Route path="/watched" element={<Watched />} />
            <Route path="/library" element={<Library />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Routes>
        </Suspense>
      </main>
      <footer className="border-t border-line px-4 py-8 text-center sm:px-8">
        <p className="credit-label">
          CineScope — data & images from{' '}
          <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer" className="text-marquee hover:underline">
            TMDB
          </a>
        </p>
      </footer>
    </>
  )
}
