import { Link } from 'react-router-dom'
import { imageUrl } from '../api/client'

// Compact poster card for library rows (DB shape: tmdb_id + media_type),
// shared by Watched, Library and EpisodeProgress to avoid circular imports.
export function MediaCardLite({ item }) {
  const poster = imageUrl(item.poster_path)
  return (
    <Link
      to={`/${item.media_type}/${item.tmdb_id}`}
      className="block overflow-hidden rounded-lg bg-surface shadow-sm ring-1 ring-line transition-transform hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="aspect-[2/3] bg-line">
        {poster ? (
          <img src={poster} alt={item.title} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center p-3 text-center">
            <span className="display text-lg text-ink-dim">{item.title}</span>
          </div>
        )}
      </div>
      <div className="px-2.5 py-2">
        <p className="truncate text-[13px] font-semibold leading-tight">{item.title}</p>
        <p className="text-[11px] text-ink-dim">{(item.release_date || '').slice(0, 4) || '—'}</p>
      </div>
    </Link>
  )
}

export function EmptyState({ message }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center rounded-2xl border border-dashed border-line px-6 text-center">
      <p className="max-w-md text-ink-dim">{message}</p>
    </div>
  )
}
