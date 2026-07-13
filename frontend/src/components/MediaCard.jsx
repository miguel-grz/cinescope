import { memo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { imageUrl } from '../api/client'
import { toMediaRef, useLibraryStore } from '../store/useLibraryStore'
import { useAuthStore } from '../store/useAuthStore'
import { useT } from '../i18n/translations'
import { EyeIcon, HeartIcon, StarIcon } from './Icons'

// Poster card. The signature "ticket stub" action bar tears open on
// hover/focus: perforated edge + watched / favorite quick toggles.
export const MediaCard = memo(function MediaCard({ item, mediaType, width = 'w-36 sm:w-40' }) {
  const t = useT()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const type = mediaType || item.media_type
  const ref = toMediaRef(item, type)
  const watched = useLibraryStore((s) => s.watchedKeys.has(`${type}:${ref.tmdb_id}`))
  const favorite = useLibraryStore((s) => s.favoriteKeys.has(`${type}:${ref.tmdb_id}`))
  const toggleWatched = useLibraryStore((s) => s.toggleWatched)
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite)

  if (type === 'person') return <PersonCard item={item} width={width} />

  const year = (ref.release_date || '').slice(0, 4)
  const poster = imageUrl(item.poster_path)

  const stop = (fn) => (e) => {
    // Buttons sit inside the poster's <Link>: stop the click from
    // bubbling into it and navigating away.
    e.preventDefault()
    e.stopPropagation()
    // Logged-out users get sent to /login instead of optimistically
    // flipping the card's state and hitting the backend with a 401.
    if (!user) {
      navigate('/login')
      return
    }
    fn()
  }

  return (
    <div className={`group relative shrink-0 ${width}`}>
      <Link
        to={`/${type}/${ref.tmdb_id}`}
        className="block overflow-hidden rounded-lg bg-surface shadow-sm ring-1 ring-line transition-transform duration-200 group-hover:-translate-y-1 group-hover:shadow-lg focus-visible:outline-2 focus-visible:outline-marquee"
      >
        <div className="relative aspect-[2/3] overflow-hidden bg-line">
          {poster ? (
            <img
              src={poster}
              alt={ref.title}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center p-3 text-center">
              <span className="display text-lg text-ink-dim">{ref.title}</span>
            </div>
          )}
          {watched && (
            <span className="absolute left-2 top-2 rounded-full bg-marquee p-1.5 text-white shadow" title={t('marked_watched')}>
              <EyeIcon size={13} filled />
            </span>
          )}
          {ref.vote_average > 0 && (
            <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-xs font-semibold text-white">
              <span className="text-gold"><StarIcon size={11} /></span>
              {ref.vote_average.toFixed(1)}
            </span>
          )}

          {/* ticket-stub quick actions: slide up over the poster's bottom edge */}
          <div className="ticket-edge absolute inset-x-0 bottom-0 flex translate-y-full items-center justify-center gap-2 bg-surface px-2 pb-2 pt-3 opacity-0 shadow-[0_-2px_8px_rgba(0,0,0,0.15)] transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
            <button
              onClick={stop(() => toggleWatched(ref))}
              title={watched ? t('unmark') : t('mark_watched')}
              aria-pressed={watched}
              className={`rounded-full p-1.5 transition-colors ${watched ? 'bg-marquee text-white' : 'bg-paper text-ink-dim hover:text-marquee'}`}
            >
              <EyeIcon size={16} filled={watched} />
            </button>
            <button
              onClick={stop(() => toggleFavorite(ref))}
              title={favorite ? t('in_favorites') : t('add_favorite')}
              aria-pressed={favorite}
              className={`rounded-full p-1.5 transition-colors ${favorite ? 'bg-marquee text-white' : 'bg-paper text-ink-dim hover:text-marquee'}`}
            >
              <HeartIcon size={16} filled={favorite} />
            </button>
          </div>
        </div>
        <div className="px-2.5 py-2">
          <p className="truncate text-[13px] font-semibold leading-tight">{ref.title}</p>
          <p className="text-[11px] text-ink-dim">{year || '—'}</p>
        </div>
      </Link>
    </div>
  )
})

function PersonCard({ item, width }) {
  const photo = imageUrl(item.profile_path)
  return (
    <Link
      to={`/person/${item.id}`}
      className={`group block shrink-0 overflow-hidden rounded-lg bg-surface shadow-sm ring-1 ring-line transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg ${width}`}
    >
      <div className="aspect-[2/3] bg-line">
        {photo ? (
          <img src={photo} alt={item.name} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center p-3 text-center">
            <span className="display text-lg text-ink-dim">{item.name}</span>
          </div>
        )}
      </div>
      <div className="px-2.5 py-2">
        <p className="truncate text-[13px] font-semibold leading-tight">{item.name}</p>
        <p className="truncate text-[11px] text-ink-dim">{item.known_for_department || ''}</p>
      </div>
    </Link>
  )
}
