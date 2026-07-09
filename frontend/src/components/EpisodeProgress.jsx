import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet, apiSend, imageUrl } from '../api/client'
import { useT } from '../i18n/translations'
import { ChevronIcon, EyeIcon } from './Icons'
import { EmptyState } from './LibraryBits'

// Per-episode watch tracking, distinct from a show being marked "watched"
// as a whole: lets partially-watched series show real progress.
export function EpisodeProgress() {
  const t = useT()
  const [shows, setShows] = useState(null)

  const refetch = () => apiGet('/library/watched-episodes', {}, { fresh: true }).then(setShows).catch(() => setShows([]))

  useEffect(() => {
    refetch()
  }, [])

  const unmarkEpisode = async (show, episode) => {
    await apiSend('DELETE', `/library/watched-episodes/${show.tmdb_id}/${episode.season_number}/${episode.episode_number}`)
    setShows((current) =>
      current
        .map((s) =>
          s.tmdb_id === show.tmdb_id
            ? { ...s, count: s.count - 1, episodes: s.episodes.filter((e) => e.id !== episode.id) }
            : s
        )
        .filter((s) => s.count > 0)
    )
  }

  return (
    <section className="mt-12">
      <h2 className="mb-1 flex items-baseline gap-3">
        <span className="h-[3px] w-6 self-center bg-marquee" aria-hidden="true" />
        <span className="display text-2xl">{t('episode_progress_title')}</span>
      </h2>
      <p className="mb-5 text-sm text-ink-dim">{t('episode_progress_hint')}</p>

      {!shows ? (
        <div className="h-24 animate-pulse rounded-2xl bg-line" />
      ) : shows.length === 0 ? (
        <EmptyState message={t('episode_progress_empty')} />
      ) : (
        <div className="space-y-3">
          {shows.map((show) => (
            <ShowProgressRow key={show.tmdb_id} show={show} onUnmark={(ep) => unmarkEpisode(show, ep)} />
          ))}
        </div>
      )}
    </section>
  )
}

function ShowProgressRow({ show, onUnmark }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const poster = imageUrl(show.poster_path, 'w92')

  const bySeasson = [...show.episodes].sort((a, b) =>
    a.season_number - b.season_number || a.episode_number - b.episode_number
  )

  return (
    <div className="overflow-hidden rounded-xl bg-surface ring-1 ring-line">
      {/* A real <Link> lives inside this row, so the row itself can't be a
          <button> (a nested <a> inside a <button> is invalid HTML with
          unreliable click behavior) — it's a div with button semantics
          instead, and the link stops propagation to navigate on its own. */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setOpen(!open)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-4 p-3 text-left transition-colors hover:bg-paper"
      >
        {poster ? (
          <img src={poster} alt="" className="h-16 w-11 rounded-lg object-cover" />
        ) : (
          <div className="h-16 w-11 rounded-lg bg-line" />
        )}
        <Link
          to={`/tv/${show.tmdb_id}`}
          onClick={(e) => e.stopPropagation()}
          className="min-w-0 flex-1 hover:text-marquee"
        >
          <p className="truncate font-semibold">{show.title || `#${show.tmdb_id}`}</p>
          <p className="text-sm text-ink-dim">
            {show.count} {t('episodes')}
          </p>
        </Link>
        <ChevronIcon open={open} />
      </div>

      {open && (
        <div className="border-t border-line">
          {bySeasson.map((episode) => (
            <div key={episode.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
              <span className="w-28 shrink-0 text-xs font-semibold text-ink-dim">
                {t('season_word')} {episode.season_number} · {t('episode_word')} {episode.episode_number}
              </span>
              <p className="min-w-0 flex-1 truncate text-sm">{episode.episode_name || '—'}</p>
              <button
                onClick={() => onUnmark(episode)}
                title={t('unmark')}
                className="shrink-0 rounded-full bg-marquee p-1.5 text-white transition-transform hover:scale-110"
              >
                <EyeIcon size={14} filled />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
