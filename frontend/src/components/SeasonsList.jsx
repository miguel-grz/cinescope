import { useEffect, useState } from 'react'
import { apiGet, imageUrl } from '../api/client'
import { tmdbLanguage, useAppStore } from '../store/useAppStore'
import { apiSend } from '../api/client'
import { useT } from '../i18n/translations'
import { ChevronIcon, EyeIcon, StarIcon } from './Icons'

// Expandable seasons with per-episode watched toggles (stored locally).
export function SeasonsList({ tvId, seasons, show }) {
  const t = useT()
  const [watchedEpisodes, setWatchedEpisodes] = useState(() => new Set())

  useEffect(() => {
    let active = true
    apiGet(`/library/watched-episodes/${tvId}`, {}, { fresh: true })
      .then((rows) => active && setWatchedEpisodes(new Set(rows.map((r) => `${r.season_number}:${r.episode_number}`))))
      .catch(() => {})
    return () => { active = false }
  }, [tvId])

  const toggleEpisode = async (season, episode, episodeName) => {
    const key = `${season}:${episode}`
    const next = new Set(watchedEpisodes)
    const wasWatched = next.has(key)
    wasWatched ? next.delete(key) : next.add(key)
    setWatchedEpisodes(next)
    try {
      if (wasWatched) await apiSend('DELETE', `/library/watched-episodes/${tvId}/${season}/${episode}`)
      else
        await apiSend('PUT', '/library/watched-episodes', {
          tmdb_id: tvId,
          season_number: season,
          episode_number: episode,
          show_title: show?.title,
          show_poster_path: show?.poster_path,
          episode_name: episodeName,
        })
    } catch { /* keep optimistic state; refetch on next mount */ }
  }

  const shown = seasons.filter((s) => s.season_number > 0 || seasons.length === 1)
  if (!shown.length) return null

  return (
    <section className="mt-10">
      <h2 className="mb-4 flex items-baseline gap-3">
        <span className="h-[3px] w-6 self-center bg-marquee" aria-hidden="true" />
        <span className="display text-xl sm:text-2xl">{t('seasons')}</span>
      </h2>
      <div className="space-y-3">
        {shown.map((season) => (
          <SeasonRow
            key={season.id}
            tvId={tvId}
            season={season}
            watchedEpisodes={watchedEpisodes}
            onToggleEpisode={toggleEpisode}
          />
        ))}
      </div>
    </section>
  )
}

function SeasonRow({ tvId, season, watchedEpisodes, onToggleEpisode }) {
  const t = useT()
  const language = useAppStore((s) => s.language)
  const [open, setOpen] = useState(false)
  const [episodes, setEpisodes] = useState(null)

  useEffect(() => {
    if (!open || episodes) return
    let active = true
    apiGet(`/tv/${tvId}/season/${season.season_number}`, { language: tmdbLanguage(language) })
      .then((data) => active && setEpisodes(data.episodes || []))
      .catch(() => active && setEpisodes([]))
    return () => { active = false }
  }, [open, episodes, tvId, season.season_number, language])

  return (
    <div className="overflow-hidden rounded-xl bg-surface ring-1 ring-line">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-4 p-3 text-left transition-colors hover:bg-paper"
      >
        {season.poster_path ? (
          <img src={imageUrl(season.poster_path, 'w92')} alt="" className="h-20 w-14 rounded-lg object-cover" />
        ) : (
          <div className="h-20 w-14 rounded-lg bg-line" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{season.name}</p>
          <p className="text-sm text-ink-dim">
            {season.episode_count} {t('episodes')}
            {season.air_date ? ` · ${season.air_date.slice(0, 4)}` : ''}
          </p>
        </div>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div className="border-t border-line">
          {!episodes ? (
            <p className="p-4 text-sm text-ink-dim">{t('loading')}</p>
          ) : (
            episodes.map((episode) => {
              const watched = watchedEpisodes.has(`${season.season_number}:${episode.episode_number}`)
              return (
                <div
                  key={episode.id}
                  className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0"
                >
                  <span className="w-8 shrink-0 text-right font-mono text-xs text-ink-dim">
                    {episode.episode_number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-medium ${watched ? 'text-ink-dim line-through' : ''}`}>
                      {episode.name}
                    </p>
                    <p className="text-xs text-ink-dim">{episode.air_date || ''}</p>
                  </div>
                  {episode.vote_average > 0 && (
                    <span className="flex shrink-0 items-center gap-1 text-xs text-ink-dim">
                      <span className="text-gold"><StarIcon size={11} /></span>
                      {episode.vote_average.toFixed(1)}
                    </span>
                  )}
                  <button
                    onClick={() => onToggleEpisode(season.season_number, episode.episode_number, episode.name)}
                    aria-pressed={watched}
                    title={watched ? t('unmark') : t('mark_watched')}
                    className={`shrink-0 rounded-full p-1.5 transition-colors ${
                      watched ? 'bg-marquee text-white' : 'text-ink-dim hover:text-marquee'
                    }`}
                  >
                    <EyeIcon size={15} filled={watched} />
                  </button>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
