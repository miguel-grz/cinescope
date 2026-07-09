import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApi, useDebounced } from '../hooks/useApi'
import { useT } from '../i18n/translations'
import { Grid, GridSkeleton, PageHeader } from '../components/Grid'
import { SearchIcon } from '../components/Icons'

const TYPES = ['multi', 'movie', 'tv', 'person']

export function Search() {
  const t = useT()
  const [params, setParams] = useSearchParams()
  const initial = params.get('q') || ''
  const [query, setQuery] = useState(initial)
  const [type, setType] = useState('multi')
  const debounced = useDebounced(query.trim())

  const { data, loading } = useApi(debounced ? '/search' : null, { query: debounced, type })

  const typeLabel = {
    multi: t('search_all'),
    movie: t('search_movies'),
    tv: t('search_tv'),
    person: t('search_people'),
  }

  const results = (data?.results || []).filter(
    (r) => r.media_type !== 'person' || r.profile_path || type === 'person'
  )

  return (
    <div className="px-4 pb-16 pt-14 sm:px-8">
      <PageHeader title={t('search_placeholder').split(',')[0]} />
      <label className="flex max-w-2xl items-center gap-3 rounded-full bg-surface px-5 py-3 ring-1 ring-line focus-within:ring-2 focus-within:ring-marquee">
        <span className="text-ink-dim"><SearchIcon /></span>
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })
          }}
          placeholder={t('search_placeholder')}
          className="w-full bg-transparent outline-none placeholder:text-ink-dim"
        />
      </label>

      <div className="mt-4 flex gap-2">
        {TYPES.map((option) => (
          <button
            key={option}
            onClick={() => setType(option)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
              type === option ? 'bg-marquee text-white' : 'bg-surface text-ink-dim ring-1 ring-line hover:text-ink'
            }`}
          >
            {typeLabel[option]}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {loading && debounced ? (
          <GridSkeleton />
        ) : results.length > 0 ? (
          <Grid items={results} />
        ) : debounced && data ? (
          <p className="pt-8 text-ink-dim">
            {t('search_no_results')} “{debounced}”
          </p>
        ) : null}
      </div>
    </div>
  )
}
