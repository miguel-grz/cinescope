import { MediaCard } from './MediaCard'

export function Grid({ items, mediaType }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {items.map((item) => (
        <MediaCard
          key={`${item.media_type || mediaType}-${item.id}`}
          item={item}
          mediaType={mediaType}
          width="w-full"
        />
      ))}
    </div>
  )
}

export function GridSkeleton({ count = 12 }) {
  return (
    <div className="grid animate-pulse grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="aspect-[2/3] rounded-lg bg-line" />
      ))}
    </div>
  )
}

export function PageHeader({ title, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 pt-8">
      <h1 className="flex items-baseline gap-3">
        <span className="h-[4px] w-8 self-center bg-marquee" aria-hidden="true" />
        <span className="display text-3xl sm:text-4xl">{title}</span>
      </h1>
      {children}
    </div>
  )
}
