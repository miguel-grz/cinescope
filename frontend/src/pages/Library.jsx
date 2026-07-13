import { useEffect, useState } from 'react'
import { apiGet } from '../api/client'
import { useAuthStore } from '../store/useAuthStore'
import { toMediaRef, useLibraryStore } from '../store/useLibraryStore'
import { useT } from '../i18n/translations'
import { GridSkeleton, PageHeader } from '../components/Grid'
import { HeartIcon, PlusIcon, StarIcon, XIcon } from '../components/Icons'
import { EmptyState, MediaCardLite } from '../components/LibraryBits'

// My Library: favorites, personal ratings and custom lists.
export function Library() {
  const t = useT()
  return (
    <div className="px-4 pb-16 pt-14 sm:px-8">
      <PageHeader title={t('library_title')} />
      <Favorites />
      <Lists />
    </div>
  )
}

function Favorites() {
  const t = useT()
  const [items, setItems] = useState(null)
  const user = useAuthStore((s) => s.user)
  const favoriteKeys = useLibraryStore((s) => s.favoriteKeys)
  const ratings = useLibraryStore((s) => s.ratings)
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite)

  useEffect(() => {
    if (!user) {
      setItems([])
      return
    }
    apiGet('/library/favorites', {}, { fresh: true })
      .then(setItems)
      .catch(() => setItems([]))
  }, [user, favoriteKeys.size])

  return (
    <section className="mb-12">
      <h2 className="mb-4 flex items-baseline gap-3">
        <span className="h-[3px] w-6 self-center bg-marquee" aria-hidden="true" />
        <span className="display text-2xl">{t('favorites')}</span>
      </h2>
      {!user ? (
        <EmptyState message={t('library_login_required')} />
      ) : !items ? (
        <GridSkeleton count={6} />
      ) : items.length === 0 ? (
        <EmptyState message={t('favorites_empty')} />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {items.map((item) => {
            const myRating = ratings.get(`${item.media_type}:${item.tmdb_id}`)
            return (
              <div key={item.id} className="relative">
                <MediaCardLite item={item} />
                <button
                  onClick={() => toggleFavorite(toMediaRef(item))}
                  title={t('remove')}
                  className="absolute right-2 top-2 z-10 rounded-full bg-marquee p-1.5 text-white shadow transition-transform hover:scale-110"
                >
                  <HeartIcon size={14} filled />
                </button>
                {myRating && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-gold">
                    <StarIcon size={11} /> {myRating}/10 · {t('my_rating')}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function Lists() {
  const t = useT()
  const user = useAuthStore((s) => s.user)
  const lists = useLibraryStore((s) => s.lists)
  const { createList, deleteList, removeFromList } = useLibraryStore.getState()
  const [newName, setNewName] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    await createList(name)
    setNewName('')
  }

  if (!user) {
    return (
      <section>
        <h2 className="mb-4 flex items-baseline gap-3">
          <span className="h-[3px] w-6 self-center bg-marquee" aria-hidden="true" />
          <span className="display text-2xl">{t('lists')}</span>
        </h2>
        <EmptyState message={t('library_login_required')} />
      </section>
    )
  }

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-baseline gap-3">
          <span className="h-[3px] w-6 self-center bg-marquee" aria-hidden="true" />
          <span className="display text-2xl">{t('lists')}</span>
        </h2>
        <form onSubmit={submit} className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t('list_new_placeholder')}
            className="rounded-full bg-surface px-4 py-2 text-sm outline-none ring-1 ring-line focus:ring-2 focus:ring-marquee"
          />
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-full bg-marquee px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-105"
          >
            <PlusIcon size={14} /> {t('list_create')}
          </button>
        </form>
      </div>

      {lists.length === 0 ? (
        <EmptyState message={t('lists_empty')} />
      ) : (
        <div className="space-y-8">
          {lists.map((list) => (
            <div key={list.id} className="rounded-2xl bg-surface p-5 ring-1 ring-line">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-lg font-bold">{list.name}</h3>
                <button
                  onClick={() => deleteList(list.id)}
                  className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold text-ink-dim transition-colors hover:text-marquee"
                >
                  <XIcon size={13} /> {t('list_delete')}
                </button>
              </div>
              {list.items.length === 0 ? (
                <p className="text-sm text-ink-dim">{t('list_empty')}</p>
              ) : (
                <div className="rail flex gap-3 overflow-x-auto pb-2">
                  {list.items.map((item) => (
                    <div key={item.id} className="relative w-32 shrink-0 sm:w-36">
                      <MediaCardLite item={item} />
                      <button
                        onClick={() => removeFromList(list.id, toMediaRef(item))}
                        title={t('remove')}
                        className="absolute right-2 top-2 z-10 rounded-full bg-black/60 p-1 text-white transition-colors hover:bg-marquee"
                      >
                        <XIcon size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
