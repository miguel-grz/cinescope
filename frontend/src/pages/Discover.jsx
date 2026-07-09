import { useMemo, useState } from 'react'
import { useApi } from '../hooks/useApi'
import { useT } from '../i18n/translations'
import { Grid, GridSkeleton, PageHeader } from '../components/Grid'

const THIS_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 70 }, (_, i) => THIS_YEAR + 1 - i)
const RATINGS = [9, 8, 7, 6, 5]

// Browse movies or TV with genre / year / minimum rating filters.
export function Discover({ mediaType }) {
  const t = useT()
  const [genre, setGenre] = useState('')
  const [year, setYear] = useState('')
  const [minRating, setMinRating] = useState('')
  const [page, setPage] = useState(1)

  const { data: genreData } = useApi('/genres')
  const genres = genreData?.[mediaType] || []

  const filters = useMemo(
    () => ({ page, with_genres: genre, year, min_rating: minRating }),
    [page, genre, year, minRating]
  )
  const { data, loading } = useApi(`/discover/${mediaType}`, filters)

  const update = (setter) => (e) => {
    setter(e.target.value)
    setPage(1)
  }
  const hasFilters = genre || year || minRating

  const selectClass =
    'rounded-full bg-surface px-4 py-1.5 text-xs font-semibold ring-1 ring-line outline-none transition-colors hover:text-marquee focus-visible:ring-2 focus-visible:ring-marquee'

  return (
    <div className="px-4 pb-16 pt-14 sm:px-8">
      <PageHeader title={mediaType === 'movie' ? t('nav_movies') : t('nav_tv')}>
        <div className="flex flex-wrap items-center gap-2">
          <select value={genre} onChange={update(setGenre)} className={selectClass} aria-label={t('filters_genre')}>
            <option value="">{t('filters_genre')}: {t('filters_all')}</option>
            {genres.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          <select value={year} onChange={update(setYear)} className={selectClass} aria-label={t('filters_year')}>
            <option value="">{t('filters_year')}: {t('filters_any')}</option>
            {YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select value={minRating} onChange={update(setMinRating)} className={selectClass} aria-label={t('filters_min_rating')}>
            <option value="">{t('filters_min_rating')}: {t('filters_any')}</option>
            {RATINGS.map((r) => (
              <option key={r} value={r}>≥ {r}</option>
            ))}
          </select>
          {hasFilters && (
            <button
              onClick={() => { setGenre(''); setYear(''); setMinRating(''); setPage(1) }}
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-marquee hover:underline"
            >
              {t('filters_clear')}
            </button>
          )}
        </div>
      </PageHeader>

      {loading || !data ? <GridSkeleton count={18} /> : <Grid items={data.results} mediaType={mediaType} />}

      {data && data.total_pages > 1 && (
        <div className="mt-10 flex items-center justify-center gap-4">
          <button
            disabled={page <= 1}
            onClick={() => { setPage(page - 1); window.scrollTo({ top: 0 }) }}
            className="rounded-full bg-surface px-5 py-2 text-sm font-semibold ring-1 ring-line transition-colors hover:text-marquee disabled:opacity-40"
          >
            ←
          </button>
          <span className="text-sm text-ink-dim">{page} / {Math.min(data.total_pages, 500)}</span>
          <button
            disabled={page >= Math.min(data.total_pages, 500)}
            onClick={() => { setPage(page + 1); window.scrollTo({ top: 0 }) }}
            className="rounded-full bg-surface px-5 py-2 text-sm font-semibold ring-1 ring-line transition-colors hover:text-marquee disabled:opacity-40"
          >
            →
          </button>
        </div>
      )}
    </div>
  )
}
