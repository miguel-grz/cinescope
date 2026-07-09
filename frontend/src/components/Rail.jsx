import { MediaCard } from './MediaCard'

// Horizontal scroll-snap carousel with a credits-style section header.
export function Rail({ title, items, mediaType, action }) {
  if (!items?.length) return null
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-end justify-between px-4 sm:px-8">
        <h2 className="flex items-baseline gap-3">
          <span className="h-[3px] w-6 self-center bg-marquee" aria-hidden="true" />
          <span className="display text-xl sm:text-2xl">{title}</span>
        </h2>
        {action}
      </div>
      <div className="rail flex gap-3 overflow-x-auto px-4 pb-10 sm:px-8">
        {items.map((item) => (
          <MediaCard key={`${item.media_type || mediaType}-${item.id}`} item={item} mediaType={mediaType} />
        ))}
      </div>
    </section>
  )
}

export function RailSkeleton({ title }) {
  return (
    <section className="mt-10 animate-pulse">
      <div className="mb-3 px-4 sm:px-8">
        <div className="h-7 w-56 rounded bg-line">{title ? '' : ''}</div>
      </div>
      <div className="flex gap-3 overflow-hidden px-4 pb-10 sm:px-8">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="aspect-[2/3] w-36 shrink-0 rounded-lg bg-line sm:w-40" />
        ))}
      </div>
    </section>
  )
}
