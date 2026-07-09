import { useState } from 'react'
import { useLibraryStore } from '../store/useLibraryStore'
import { useT } from '../i18n/translations'
import { ChevronIcon, EyeIcon, HeartIcon, PlusIcon, StarIcon } from './Icons'

// Full action bar for detail pages: watched, favorite, my rating, add-to-list.
export function LibraryActions({ mediaRef }) {
  const t = useT()
  const key = `${mediaRef.media_type}:${mediaRef.tmdb_id}`
  const watched = useLibraryStore((s) => s.watchedKeys.has(key))
  const favorite = useLibraryStore((s) => s.favoriteKeys.has(key))
  const rating = useLibraryStore((s) => s.ratings.get(key) ?? null)
  const { toggleWatched, toggleFavorite, setRating } = useLibraryStore.getState()

  const pill = (active) =>
    `flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ring-1 transition-colors ${
      active
        ? 'bg-marquee text-white ring-marquee'
        : 'bg-surface text-ink ring-line hover:text-marquee hover:ring-marquee'
    }`

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={() => toggleWatched(mediaRef)} aria-pressed={watched} className={pill(watched)}>
        <EyeIcon size={16} filled={watched} />
        {watched ? t('marked_watched') : t('mark_watched')}
      </button>
      <button onClick={() => toggleFavorite(mediaRef)} aria-pressed={favorite} className={pill(favorite)}>
        <HeartIcon size={16} filled={favorite} />
        {favorite ? t('in_favorites') : t('add_favorite')}
      </button>
      <RatingControl value={rating} onChange={(score) => setRating(mediaRef, score)} />
      <AddToList mediaRef={mediaRef} />
    </div>
  )
}

// 1–10 star strip. Clicking the current score clears it.
function RatingControl({ value, onChange }) {
  const t = useT()
  const [hover, setHover] = useState(null)
  const shown = hover ?? value ?? 0

  return (
    <div
      className="flex items-center gap-1.5 rounded-full bg-surface px-4 py-2 ring-1 ring-line"
      onMouseLeave={() => setHover(null)}
      role="radiogroup"
      aria-label={t('my_rating')}
    >
      <span className="credit-label hidden sm:inline">{t('my_rating')}</span>
      <div className="flex">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((score) => (
          <button
            key={score}
            role="radio"
            aria-checked={value === score}
            aria-label={`${score}/10`}
            onMouseEnter={() => setHover(score)}
            onClick={() => onChange(value === score ? null : score)}
            className={`p-0.5 transition-colors ${score <= shown ? 'text-gold' : 'text-line'}`}
          >
            <StarIcon size={15} filled={score <= shown} />
          </button>
        ))}
      </div>
      {value && <span className="text-sm font-bold text-gold">{value}</span>}
    </div>
  )
}

function AddToList({ mediaRef }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const lists = useLibraryStore((s) => s.lists)
  const { addToList, removeFromList, createList } = useLibraryStore.getState()

  const inList = (list) =>
    list.items.some((i) => i.tmdb_id === mediaRef.tmdb_id && i.media_type === mediaRef.media_type)

  const createAndAdd = async (e) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    const created = await createList(name)
    await addToList(created.id, mediaRef)
    setNewName('')
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm font-semibold ring-1 ring-line transition-colors hover:text-marquee hover:ring-marquee"
      >
        <PlusIcon size={16} />
        {t('add_to_list')}
        <ChevronIcon size={14} open={open} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-2 w-64 rounded-xl bg-surface p-2 shadow-xl ring-1 ring-line">
          {lists.map((list) => {
            const active = inList(list)
            return (
              <button
                key={list.id}
                onClick={() => (active ? removeFromList(list.id, mediaRef) : addToList(list.id, mediaRef))}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-paper"
              >
                <span className="truncate">{list.name}</span>
                {active && <span className="font-bold text-marquee">✓</span>}
              </button>
            )
          })}
          <form onSubmit={createAndAdd} className="mt-1 flex gap-1 border-t border-line pt-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t('list_new_placeholder')}
              className="w-full rounded-lg bg-paper px-3 py-1.5 text-sm outline-none ring-1 ring-line focus:ring-marquee"
            />
            <button type="submit" className="rounded-lg bg-marquee px-2.5 text-white" aria-label={t('list_create')}>
              <PlusIcon size={14} />
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
