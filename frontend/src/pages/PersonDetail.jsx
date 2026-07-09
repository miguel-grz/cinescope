import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { imageUrl } from '../api/client'
import { useApi } from '../hooks/useApi'
import { useAppStore } from '../store/useAppStore'
import { useT } from '../i18n/translations'
import { Grid, GridSkeleton } from '../components/Grid'
import { ExpandableText } from '../components/ExpandableText'
import { ErrorNote } from './Home'

// Below this length a "biography" is usually just a stub TMDB imported
// from somewhere else — not worth showing on its own, better to point
// out to Wikipedia/IMDb instead.
const MIN_USEFUL_BIO_LENGTH = 40

// Person profile: bio, photo and full filmography sortable by
// popularity or release date.
export function PersonDetail() {
  const { id } = useParams()
  const t = useT()
  const language = useAppStore((s) => s.language)
  const [tab, setTab] = useState('cast')
  const [sort, setSort] = useState('popularity')
  const { data, error, loading } = useApi(`/person/${id}/full`)

  const credits = useMemo(() => {
    if (!data) return []
    const source = tab === 'cast' ? data.cast_credits : data.crew_credits
    // Dedupe titles (same movie can appear per character/job)
    const seen = new Set()
    const unique = source.filter((c) => {
      const key = `${c.media_type}:${c.id}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    if (sort === 'date') {
      return [...unique].sort((a, b) =>
        (b.release_date || b.first_air_date || '').localeCompare(a.release_date || a.first_air_date || '')
      )
    }
    return unique
  }, [data, tab, sort])

  if (error) return <ErrorNote message={t('error_generic')} />
  if (loading || !data) {
    return (
      <div className="px-4 pt-24 sm:px-8">
        <GridSkeleton />
      </div>
    )
  }

  const photo = imageUrl(data.profile_path, 'w500')
  const hasCrew = data.crew_credits.length > 0
  const hasUsefulBio = (data.biography || '').trim().length >= MIN_USEFUL_BIO_LENGTH
  const wikipediaUrl = `https://${language === 'en' ? 'en' : 'es'}.wikipedia.org/w/index.php?search=${encodeURIComponent(data.name)}`
  const imdbUrl = data.imdb_id ? `https://www.imdb.com/name/${data.imdb_id}/` : null

  const chip = (active) =>
    `rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
      active ? 'bg-marquee text-white' : 'bg-surface text-ink-dim ring-1 ring-line hover:text-ink'
    }`

  return (
    <div className="px-4 pb-16 pt-20 sm:px-8">
      <div className="flex flex-col gap-8 md:flex-row">
        {photo && (
          <img src={photo} alt={data.name} className="w-52 self-start rounded-xl shadow-xl ring-1 ring-line md:w-64" />
        )}
        <div className="max-w-3xl">
          <h1 className="display text-4xl sm:text-6xl">{data.name}</h1>
          <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
            {data.known_for_department && (
              <div>
                <dt className="credit-label">{t('known_for')}</dt>
                <dd className="text-sm font-semibold">{data.known_for_department}</dd>
              </div>
            )}
            {data.birthday && (
              <div>
                <dt className="credit-label">{t('born')}</dt>
                <dd className="text-sm font-semibold">
                  {data.birthday}{data.place_of_birth ? ` · ${data.place_of_birth}` : ''}
                </dd>
              </div>
            )}
            {data.deathday && (
              <div>
                <dt className="credit-label">{t('died')}</dt>
                <dd className="text-sm font-semibold">{data.deathday}</dd>
              </div>
            )}
          </div>
          <h2 className="credit-label mt-6 mb-1.5">{t('biography')}</h2>
          {hasUsefulBio ? (
            <ExpandableText
              text={data.biography}
              lines={10}
              className="max-w-2xl text-sm leading-relaxed text-ink"
            />
          ) : (
            <div>
              <p className="text-sm text-ink-dim">{t('no_bio_message')}</p>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
                <a href={wikipediaUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-marquee hover:underline">
                  {t('search_wikipedia')} ↗
                </a>
                {imdbUrl && (
                  <a href={imdbUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-marquee hover:underline">
                    {t('view_imdb')} ↗
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-12 mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-baseline gap-3">
          <span className="h-[3px] w-6 self-center bg-marquee" aria-hidden="true" />
          <span className="display text-2xl">{t('filmography')}</span>
        </h2>
        <div className="flex gap-2">
          {hasCrew && (
            <>
              <button onClick={() => setTab('cast')} className={chip(tab === 'cast')}>{t('as_cast')}</button>
              <button onClick={() => setTab('crew')} className={chip(tab === 'crew')}>{t('as_crew')}</button>
              <span className="mx-1 w-px bg-line" aria-hidden="true" />
            </>
          )}
          <button onClick={() => setSort('popularity')} className={chip(sort === 'popularity')}>{t('sort_popularity')}</button>
          <button onClick={() => setSort('date')} className={chip(sort === 'date')}>{t('sort_date')}</button>
        </div>
      </div>
      <Grid items={credits.filter((c) => c.poster_path)} />
    </div>
  )
}
