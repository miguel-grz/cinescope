import { useCallback, useEffect, useState } from 'react'
import { apiGet } from '../api/client'
import { useAuthStore } from '../store/useAuthStore'
import { useLibraryStore, toMediaRef } from '../store/useLibraryStore'
import { useT } from '../i18n/translations'
import { GridSkeleton, PageHeader } from '../components/Grid'
import { EyeIcon } from '../components/Icons'
import { EmptyState, MediaCardLite } from '../components/LibraryBits'
import { EpisodeProgress } from '../components/EpisodeProgress'

const SORTS = [
  { value: 'watched_at', key: 'watched_sort_date' },
  { value: 'title', key: 'watched_sort_title' },
  { value: 'vote_average', key: 'watched_sort_rating' },
]

// Everything marked as watched, sortable, with inline unmark.
export function Watched() {
  const t = useT()
  const user = useAuthStore((s) => s.user)
  const [sort, setSort] = useState('watched_at')
  const [order, setOrder] = useState('desc')
  const [items, setItems] = useState(null)
  const toggleWatched = useLibraryStore((s) => s.toggleWatched)

  const fetchItems = useCallback(() => {
    if (!user) {
      setItems([])
      return
    }
    apiGet('/library/watched', { sort, order }, { fresh: true })
      .then(setItems)
      .catch(() => setItems([]))
  }, [user, sort, order])

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

      {!user ? (
        <EmptyState message={t('library_login_required')} />
      ) : !items ? (
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

      {user && <EpisodeProgress />}
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
