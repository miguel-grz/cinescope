import { useCallback, useEffect, useState } from 'react'
import { apiGet } from '../api/client'
import { useLibraryStore, toMediaRef } from '../store/useLibraryStore'
import { useT } from '../i18n/translations'
import { Grid, GridSkeleton, PageHeader } from '../components/Grid'
import { EyeIcon } from '../components/Icons'

const SORTS = [
  { value: 'watched_at', key: 'watched_sort_date' },
  { value: 'title', key: 'watched_sort_title' },
  { value: 'vote_average', key: 'watched_sort_rating' },
]

// Everything marked as watched, sortable, with inline unmark.
export function Watched() {
  const t = useT()
  const [sort, setSort] = useState('watched_at')
  const [order, setOrder] = useState('desc')
  const [items, setItems] = useState(null)
  const toggleWatched = useLibraryStore((s) => s.toggleWatched)

  const fetchItems = useCallback(() => {
    apiGet('/library/watched', { sort, order }, { fresh: true })
      .then(setItems)
      .catch(() => setItems([]))
  }, [sort, order])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const unmark = async (item) => {
    await toggleWatched(toMediaRef(item))
    setItems((current) => current.filter((i) => i.id !== item.id))
  }

  const chip = (active) =>
    `rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
      active ? 'bg-marquee text-white' : 'bg-surface text-ink-dim ring-1 ring-line hover:text-ink'
    }`

  return (
    <div className="px-4 pb-16 pt-14 sm:px-8">
      <PageHeader title={t('watched_title')}>
        {items?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {SORTS.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  if (sort === option.value) setOrder(order === 'desc' ? 'asc' : 'desc')
                  else {
                    setSort(option.value)
                    setOrder(option.value === 'title' ? 'asc' : 'desc')
                  }
                }}
                className={chip(sort === option.value)}
              >
                {t(option.key)} {sort === option.value ? (order === 'desc' ? '↓' : '↑') : ''}
              </button>
            ))}
          </div>
        )}
      </PageHeader>

      {!items ? (
        <GridSkeleton />
      ) : items.length === 0 ? (
        <EmptyState message={t('watched_empty')} />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {items.map((item) => (
            <WatchedCard key={item.id} item={item} onUnmark={() => unmark(item)} />
          ))}
        </div>
      )}
    </div>
  )
}

function WatchedCard({ item, onUnmark }) {
  const t = useT()
  return (
    <div className="relative">
      <MediaCardLite item={item} />
      <button
        onClick={onUnmark}
        title={t('unmark')}
        className="absolute right-2 top-2 z-10 rounded-full bg-marquee p-1.5 text-white shadow transition-transform hover:scale-110"
      >
        <EyeIcon size={14} filled />
      </button>
      <p className="mt-1 text-[11px] text-ink-dim">
        {new Date(item.watched_at).toLocaleDateString()}
      </p>
    </div>
  )
}

// Compact poster card for library rows (DB shape: tmdb_id + media_type).
import { Link } from 'react-router-dom'
import { imageUrl } from '../api/client'

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
