import { Link } from 'react-router-dom'
import { imageUrl } from '../api/client'
import { useT } from '../i18n/translations'
import { ScrollRail } from './ScrollRail'

export function CastRail({ cast }) {
  const t = useT()
  if (!cast?.length) return null
  const shown = cast.slice(0, 25)
  return (
    <section className="mt-10">
      <h2 className="mb-4 flex items-baseline gap-3">
        <span className="h-[3px] w-6 self-center bg-marquee" aria-hidden="true" />
        <span className="display text-xl sm:text-2xl">{t('cast')}</span>
      </h2>
      <ScrollRail className="rail flex gap-3 overflow-x-auto pb-4" itemCount={shown.length}>
        {shown.map((member) => (
          <Link
            key={member.credit_id}
            to={`/person/${member.id}`}
            className="w-28 shrink-0 overflow-hidden rounded-lg bg-surface shadow-sm ring-1 ring-line transition-transform hover:-translate-y-1 hover:shadow-lg"
          >
            <div className="aspect-[2/3] bg-line">
              {member.profile_path ? (
                <img
                  src={imageUrl(member.profile_path, 'w185')}
                  alt={member.name}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center p-2 text-center">
                  <span className="display text-sm text-ink-dim">{member.name}</span>
                </div>
              )}
            </div>
            <div className="px-2 py-2">
              <p className="truncate text-xs font-semibold">{member.name}</p>
              <p className="truncate text-[11px] text-ink-dim">{member.character || member.roles?.[0]?.character}</p>
            </div>
          </Link>
        ))}
      </ScrollRail>
    </section>
  )
}
