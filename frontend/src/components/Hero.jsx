import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { imageUrl } from '../api/client'
import { useT } from '../i18n/translations'
import { StarIcon } from './Icons'

const ROTATE_MS = 8000

// Full-bleed rotating hero over the week's top trending titles.
export function Hero({ items }) {
  const t = useT()
  const featured = items.slice(0, 6)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (featured.length < 2) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % featured.length), ROTATE_MS)
    return () => clearInterval(timer)
  }, [featured.length])

  const item = featured[index]
  if (!item) return null
  const type = item.media_type || 'movie'
  const title = item.title || item.name
  const year = (item.release_date || item.first_air_date || '').slice(0, 4)

  return (
    <section className="relative -mt-14 min-h-[68vh] overflow-hidden md:-mt-14">
      {featured.map((f, i) => (
        <img
          key={f.id}
          src={imageUrl(f.backdrop_path, 'w1280')}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-1000"
          style={{ opacity: i === index ? 1 : 0 }}
        />
      ))}
      <div className="scrim-b absolute inset-0" />
      <div className="scrim-l absolute inset-0 hidden sm:block" />

      <div className="relative flex min-h-[68vh] flex-col justify-end px-4 pb-12 pt-28 sm:px-8 sm:pb-16 md:max-w-3xl">
        <p className="credit-label mb-3 !text-marquee">{t('hero_trending_now')}</p>
        <h1 className="display text-5xl sm:text-7xl">{title}</h1>
        <div className="mt-4 flex items-center gap-4 text-sm text-ink-dim">
          {item.vote_average > 0 && (
            <span className="flex items-center gap-1.5 font-semibold text-ink">
              <span className="text-gold"><StarIcon size={15} /></span>
              {item.vote_average.toFixed(1)}
            </span>
          )}
          {year && <span>{year}</span>}
          <span className="uppercase">{type === 'movie' ? t('movie') : t('tv_show')}</span>
        </div>
        {item.overview && (
          <p className="mt-4 line-clamp-3 max-w-xl text-sm leading-relaxed text-ink-dim sm:text-base">
            {item.overview}
          </p>
        )}
        <div className="mt-6 flex items-center gap-4">
          <Link
            to={`/${type}/${item.id}`}
            className="rounded-full bg-marquee px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquee"
          >
            {t('hero_details')}
          </Link>
          <div className="flex gap-1.5" role="tablist" aria-label="Featured">
            {featured.map((f, i) => (
              <button
                key={f.id}
                onClick={() => setIndex(i)}
                aria-label={f.title || f.name}
                className={`h-1.5 rounded-full transition-all ${i === index ? 'w-6 bg-marquee' : 'w-1.5 bg-ink-dim/40 hover:bg-ink-dim'}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
