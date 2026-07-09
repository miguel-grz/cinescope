import { useState } from 'react'
import { useT } from '../i18n/translations'
import { PlayIcon } from './Icons'

// YouTube embeds behind a click-to-play facade: no iframe cost until play.
export function VideoRail({ videos }) {
  const t = useT()
  if (!videos?.length) return null
  return (
    <section className="mt-10">
      <h2 className="mb-4 flex items-baseline gap-3">
        <span className="h-[3px] w-6 self-center bg-marquee" aria-hidden="true" />
        <span className="display text-xl sm:text-2xl">{t('videos')}</span>
      </h2>
      <div className="rail flex gap-4 overflow-x-auto pb-4">
        {videos.slice(0, 8).map((video) => (
          <VideoCard key={video.id} video={video} />
        ))}
      </div>
    </section>
  )
}

function VideoCard({ video }) {
  const [playing, setPlaying] = useState(false)
  return (
    <div className="w-72 shrink-0 sm:w-80">
      <div className="relative aspect-video overflow-hidden rounded-lg bg-black shadow ring-1 ring-line">
        {playing ? (
          <iframe
            src={`https://www.youtube.com/embed/${video.key}?autoplay=1`}
            title={video.name}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        ) : (
          <button
            onClick={() => setPlaying(true)}
            className="group/video relative block h-full w-full"
            aria-label={`Play: ${video.name}`}
          >
            <img
              src={`https://img.youtube.com/vi/${video.key}/hqdefault.jpg`}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover opacity-90 transition-opacity group-hover/video:opacity-100"
            />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-full bg-marquee p-4 text-white shadow-lg transition-transform group-hover/video:scale-110">
                <PlayIcon size={20} />
              </span>
            </span>
          </button>
        )}
      </div>
      <p className="mt-2 truncate text-sm font-medium">{video.name}</p>
    </div>
  )
}
