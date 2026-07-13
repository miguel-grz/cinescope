import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { useAuthStore } from '../store/useAuthStore'
import { useT } from '../i18n/translations'
import { ApertureLogo, MoonIcon, SearchIcon, SunIcon } from './Icons'

const navLinkClass = ({ isActive }) =>
  `credit-label !tracking-[0.14em] rounded px-2 py-1 transition-colors hover:!text-marquee ${
    isActive ? '!text-marquee' : ''
  }`

export function NavBar() {
  const t = useT()
  const navigate = useNavigate()
  const { language, setLanguage, theme, toggleTheme } = useAppStore()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)

  // "/" focuses search from anywhere
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const submit = (e) => {
    e.preventDefault()
    const q = query.trim()
    if (q) {
      navigate(`/search?q=${encodeURIComponent(q)}`)
      setQuery('')
      inputRef.current?.blur()
    }
  }

  const doLogout = async () => {
    await logout()
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-md">
      <div className="flex h-14 items-center gap-3 px-4 sm:gap-5 sm:px-8">
        <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="CineScope">
          <ApertureLogo size={24} />
          <span className="display text-xl tracking-wide">
            Cine<span className="text-marquee">Scope</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <NavLink to="/movies" className={navLinkClass}>{t('nav_movies')}</NavLink>
          <NavLink to="/tv" className={navLinkClass}>{t('nav_tv')}</NavLink>
          <NavLink to="/watched" className={navLinkClass}>{t('nav_watched')}</NavLink>
          <NavLink to="/library" className={navLinkClass}>{t('nav_library')}</NavLink>
        </nav>

        <form onSubmit={submit} className="ml-auto min-w-0 flex-1 max-w-sm">
          <label className="flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 ring-1 ring-line transition-shadow focus-within:ring-2 focus-within:ring-marquee">
            <span className="text-ink-dim"><SearchIcon size={15} /></span>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('search_placeholder')}
              className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-ink-dim"
            />
          </label>
        </form>

        <div className="flex shrink-0 items-center gap-2">
          {user ? (
            <>
              <span className="hidden text-xs text-ink-dim sm:inline">{user.email}</span>
              <button
                onClick={doLogout}
                className="credit-label rounded px-2 py-1 !tracking-[0.14em] transition-colors hover:!text-marquee"
              >
                {t('nav_logout')}
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="credit-label rounded px-2 py-1 !tracking-[0.14em] transition-colors hover:!text-marquee"
            >
              {t('nav_login')}
            </Link>
          )}
          <button
            onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
            className="credit-label rounded px-2 py-1 !tracking-[0.14em] transition-colors hover:!text-marquee"
            title={language === 'es' ? 'Switch to English' : 'Cambiar a español'}
          >
            {language === 'es' ? 'EN' : 'ES'}
          </button>
          <button
            onClick={toggleTheme}
            className="rounded-full p-2 text-ink-dim transition-colors hover:text-marquee"
            title={theme === 'light' ? 'Dark mode' : 'Light mode'}
          >
            {theme === 'light' ? <MoonIcon size={17} /> : <SunIcon size={17} />}
          </button>
        </div>
      </div>

      {/* mobile nav */}
      <nav className="flex items-center gap-1 overflow-x-auto px-3 pb-2 md:hidden">
        <NavLink to="/movies" className={navLinkClass}>{t('nav_movies')}</NavLink>
        <NavLink to="/tv" className={navLinkClass}>{t('nav_tv')}</NavLink>
        <NavLink to="/watched" className={navLinkClass}>{t('nav_watched')}</NavLink>
        <NavLink to="/library" className={navLinkClass}>{t('nav_library')}</NavLink>
      </nav>
    </header>
  )
}
