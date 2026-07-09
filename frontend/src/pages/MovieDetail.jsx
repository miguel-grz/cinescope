import { useParams } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { useAppStore } from '../store/useAppStore'
import { toMediaRef } from '../store/useLibraryStore'
import { useT } from '../i18n/translations'
import { DetailHero } from '../components/DetailHero'
import { WatchProviders } from '../components/WatchProviders'
import { VideoRail } from '../components/VideoRail'
import { CastRail } from '../components/CastRail'
import { Rail } from '../components/Rail'
import { ErrorNote } from './Home'

export function MovieDetail() {
  const { id } = useParams()
  const t = useT()
  const region = useAppStore((s) => s.region)
  const { data, error, loading } = useApi(`/movie/${id}/full`, { region })

  if (error) return <ErrorNote message={t('error_generic')} />
  if (loading || !data) return <DetailSkeleton />

  const year = (data.release_date || '').slice(0, 4)
  const runtime = data.runtime ? `${Math.floor(data.runtime / 60)}h ${data.runtime % 60}${t('minutes')}` : null

  // Deduplicate: director/writer crew list, top names only
  const keyCrew = data.key_crew.slice(0, 4).map((m) => ({
    ...m,
    job: m.job === 'Director' ? t('director') : ['Writer', 'Screenplay', 'Story'].includes(m.job) ? t('writer') : m.job,
  }))

  return (
    <div className="pb-16">
      <DetailHero
        item={data}
        mediaRef={toMediaRef(data, 'movie')}
        metaLine={[year, runtime]}
        keyCrew={keyCrew}
      />
      <div className="px-4 sm:px-8">
        <WatchProviders providers={data.watch_providers} />
        <CastRail cast={data.cast} />
        <VideoRail videos={data.videos} />
      </div>
      <Rail title={t('recommendations')} items={data.recommendations} mediaType="movie" />
      <Rail title={t('similar')} items={data.similar} mediaType="movie" />
    </div>
  )
}

export function DetailSkeleton() {
  return (
    <div className="animate-pulse px-4 pt-24 sm:px-8">
      <div className="flex gap-8">
        <div className="hidden aspect-[2/3] w-64 rounded-xl bg-line md:block" />
        <div className="flex-1 space-y-4 pt-8">
          <div className="h-12 w-2/3 rounded bg-line" />
          <div className="h-4 w-1/3 rounded bg-line" />
          <div className="h-24 w-full max-w-2xl rounded bg-line" />
          <div className="h-10 w-96 max-w-full rounded-full bg-line" />
        </div>
      </div>
      <div className="mt-10 flex gap-3 overflow-hidden">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="aspect-[2/3] w-28 shrink-0 rounded-lg bg-line" />
        ))}
      </div>
    </div>
  )
}
