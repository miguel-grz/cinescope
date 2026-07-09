import { useLayoutEffect, useRef, useState } from 'react'
import { ArrowIcon } from './Icons'

// Wraps a horizontal scroll-snap track with left/right arrow buttons —
// trackpad/swipe still works, but pointer-and-keyboard users get a
// discoverable click target too. Each arrow hides at its scroll edge.
export function ScrollRail({ children, className = '', itemCount }) {
  const trackRef = useRef(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(true)

  const updateEdges = () => {
    const el = trackRef.current
    if (!el) return
    setAtStart(el.scrollLeft <= 1)
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1)
  }

  useLayoutEffect(() => {
    const el = trackRef.current
    if (!el) return
    updateEdges()
    el.addEventListener('scroll', updateEdges, { passive: true })
    const observer = new ResizeObserver(updateEdges)
    observer.observe(el)
    return () => {
      el.removeEventListener('scroll', updateEdges)
      observer.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemCount])

  const scrollBy = (direction) => {
    const el = trackRef.current
    if (!el) return
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: 'smooth' })
  }

  const arrowClass =
    'absolute top-1/2 z-10 -translate-y-1/2 rounded-full bg-surface/90 p-2 text-ink shadow-lg ring-1 ring-line backdrop-blur transition-transform hover:scale-110 hover:text-marquee focus-visible:outline-2 focus-visible:outline-marquee'

  return (
    <div className="relative">
      <div ref={trackRef} className={className}>
        {children}
      </div>

      {!atStart && (
        <button onClick={() => scrollBy(-1)} aria-label="Scroll left" className={`${arrowClass} left-1 sm:left-3`}>
          <ArrowIcon direction="left" />
        </button>
      )}
      {!atEnd && (
        <button onClick={() => scrollBy(1)} aria-label="Scroll right" className={`${arrowClass} right-1 sm:right-3`}>
          <ArrowIcon direction="right" />
        </button>
      )}
    </div>
  )
}
