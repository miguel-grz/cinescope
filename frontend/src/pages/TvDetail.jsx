import { useParams } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { useAppStore } from '../store/useAppStore'
import { toMediaRef } from '../store/useLibraryStore'
import { useT } from '../i18n/translations'
import { DetailHero } from '../components/DetailHero'
import { WatchProviders } from '../components/WatchProviders'
import { VideoRail } from '../components/VideoRail'
import { CastRail } from '../components/CastRail'
import { SeasonsList } from '../components/SeasonsList'
import { Rail } from '../components/Rail'
import { DetailSkeleton } from './MovieDetail'
import { ErrorNote } from './Home'

export function TvDetail() {
  const { id } = useParams()
  const t = useT()
  const region = useAppStore((s) => s.region)
  const { data, error, loading } = useApi(`/tv/${id}/full`, { region })

  if (error) return <ErrorNote message={t('error_generic')} />
  if (loading || !data) return <DetailSkeleton />

  const years = [data.first_air_date, data.last_air_date]
    .filter(Boolean)
    .map((d) => d.slice(0, 4))
  const yearRange = years.length === 2 && years[0] !== years[1] ? `${years[0]}–${years[1]}` : years[0]
  const seasonCount = data.number_of_seasons
  const seasonsLabel = seasonCount
    ? `${seasonCount} ${seasonCount === 1 ? t('season_one') : t('season_many')}`
    : null

  const creators = (data.created_by || []).map((c) => ({ ...c, job: t('creator') }))
  const keyCrew = [...creators, ...data.key_crew.filter((m) => m.job !== 'Creator')].slice(0, 4)

  return (
    <div className="pb-16">
      <DetailHero
        item={data}
        mediaRef={toMediaRef(data, 'tv')}
        metaLine={[yearRange, seasonsLabel]}
        keyCrew={keyCrew}
      />
      <div className="px-4 sm:px-8">
        <WatchProviders providers={data.watch_providers} />
        <SeasonsList
          tvId={Number(id)}
          seasons={data.seasons || []}
          show={{ title: data.name, poster_path: data.poster_path }}
        />
        <CastRail cast={data.cast} />
        <VideoRail videos={data.videos} />
      </div>
      <Rail title={t('recommendations')} items={data.recommendations} mediaType="tv" />
      <Rail title={t('similar')} items={data.similar} mediaType="tv" />
    </div>
  )
}
