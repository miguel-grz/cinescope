import { Link } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { useT } from '../i18n/translations'
import { Hero } from '../components/Hero'
import { Rail, RailSkeleton } from '../components/Rail'

export function Home() {
  const t = useT()
  const { data, error, loading } = useApi('/home')

  if (error) return <ErrorNote message={t('error_generic')} />
  if (loading || !data) {
    return (
      <div className="pt-14">
        {Array.from({ length: 4 }, (_, i) => <RailSkeleton key={i} />)}
      </div>
    )
  }

  const viewAll = (to) => (
    <Link to={to} className="credit-label !tracking-[0.14em] transition-colors hover:!text-marquee">
      {t('view_all')} →
    </Link>
  )

  return (
    <div>
      <Hero items={data.trending_movies} />
      <Rail title={t('section_trending_movies')} items={data.trending_movies} mediaType="movie" action={viewAll('/movies')} />
      <Rail title={t('section_trending_tv')} items={data.trending_tv} mediaType="tv" action={viewAll('/tv')} />
      <Rail title={t('section_upcoming')} items={data.upcoming_movies} mediaType="movie" />
      <Rail title={t('section_popular_movies')} items={data.popular_movies} mediaType="movie" />
      <Rail title={t('section_popular_tv')} items={data.popular_tv} mediaType="tv" />
      <Rail title={t('section_top_movies')} items={data.top_rated_movies} mediaType="movie" />
      <Rail title={t('section_top_tv')} items={data.top_rated_tv} mediaType="tv" />
    </div>
  )
}

export function ErrorNote({ message }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-6 pt-14 text-center">
      <p className="max-w-md text-ink-dim">{message}</p>
    </div>
  )
}
