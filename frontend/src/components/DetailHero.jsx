import { imageUrl } from '../api/client'
import { useT } from '../i18n/translations'
import { StarIcon } from './Icons'
import { LibraryActions } from './LibraryActions'

// Immersive detail header: blurred backdrop wash, floating poster,
// credits-style metadata and the personal-library action bar.
export function DetailHero({ item, mediaRef, metaLine, keyCrew }) {
  const t = useT()
  const backdrop = imageUrl(item.backdrop_path, 'w1280')
  const poster = imageUrl(item.poster_path, 'w500')
  const title = item.title || item.name
  const originalTitle = item.original_title || item.original_name

  return (
    <section className="relative overflow-hidden">
      {backdrop && (
        <>
          <img
            src={backdrop}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full scale-110 object-cover blur-md"
          />
          {/* paper-tinted wash keeps ink text readable over any backdrop, in both themes */}
          <div className="absolute inset-0 bg-paper/70" />
          <div className="scrim-b absolute inset-0" />
        </>
      )}

      <div className="relative flex flex-col gap-8 px-4 pb-10 pt-24 sm:px-8 md:flex-row md:items-end">
        {poster && (
          <img
            src={poster}
            alt={title}
            className="w-44 shrink-0 self-start rounded-xl shadow-2xl ring-1 ring-line md:w-64"
          />
        )}
        <div className="max-w-3xl">
          <h1 className="display text-4xl sm:text-6xl">{title}</h1>
          {originalTitle && originalTitle !== title && (
            <p className="mt-1 text-sm italic text-ink-dim">{originalTitle}</p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-dim">
            {item.vote_average > 0 && (
              <span className="flex items-center gap-1.5 font-semibold text-ink">
                <span className="text-gold"><StarIcon size={15} /></span>
                {item.vote_average.toFixed(1)}
                <span className="font-normal text-ink-dim">({item.vote_count?.toLocaleString()})</span>
              </span>
            )}
            {metaLine.filter(Boolean).map((part) => (
              <span key={part}>{part}</span>
            ))}
          </div>

          {item.genres?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {item.genres.map((genre) => (
                <span key={genre.id} className="rounded-full bg-surface px-3 py-1 text-xs font-semibold ring-1 ring-line">
                  {genre.name}
                </span>
              ))}
            </div>
          )}

          {item.tagline && <p className="mt-4 italic text-ink-dim">“{item.tagline}”</p>}

          {item.overview && (
            <>
              <h2 className="credit-label mt-5 mb-1.5">{t('overview')}</h2>
              <p className="max-w-2xl text-sm leading-relaxed sm:text-[15px]">{item.overview}</p>
            </>
          )}

          {keyCrew?.length > 0 && (
            <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-2">
              {keyCrew.map((member) => (
                <div key={`${member.id}-${member.job}`}>
                  <dt className="credit-label">{member.job}</dt>
                  <dd className="text-sm font-semibold">{member.name}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="mt-6">
            <LibraryActions mediaRef={mediaRef} />
          </div>
        </div>
      </div>
    </section>
  )
}
