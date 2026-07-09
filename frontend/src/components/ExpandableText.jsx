import { useLayoutEffect, useRef, useState } from 'react'
import { useT } from '../i18n/translations'

// Clamps text to `lines` and only shows a "read more" toggle when the
// text actually overflows — measured via scrollHeight, not guessed from
// character count (which breaks across font sizes/column widths).
export function ExpandableText({ text, lines = 8, className = '' }) {
  const t = useT()
  const ref = useRef(null)
  const [clamped, setClamped] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setClamped(el.scrollHeight - el.clientHeight > 1)
  }, [text, lines])

  return (
    <div>
      <p
        ref={ref}
        style={!expanded ? { display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : undefined}
        className={`whitespace-pre-line ${className}`}
      >
        {text}
      </p>
      {(clamped || expanded) && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1.5 text-xs font-semibold text-marquee hover:underline"
        >
          {expanded ? t('read_less') : t('read_more')}
        </button>
      )}
    </div>
  )
}
