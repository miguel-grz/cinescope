import { useEffect, useState } from 'react'
import { apiGet } from '../api/client'
import { tmdbLanguage, useAppStore } from '../store/useAppStore'

// Fetch from the backend, re-running when the app language changes.
// `path === null` skips the request (for dependent queries).
export function useApi(path, params = {}) {
  const language = useAppStore((s) => s.language)
  const region = useAppStore((s) => s.region)
  const [state, setState] = useState({ data: null, error: null, loading: !!path })

  const paramsKey = JSON.stringify(params)

  useEffect(() => {
    if (!path) return
    const controller = new AbortController()
    let active = true
    setState((s) => ({ ...s, loading: true, error: null }))
    apiGet(
      path,
      { ...JSON.parse(paramsKey), language: tmdbLanguage(language, region) },
      { signal: controller.signal }
    )
      .then((data) => active && setState({ data, error: null, loading: false }))
      .catch((error) => {
        if (active && error.name !== 'AbortError') setState({ data: null, error, loading: false })
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [path, paramsKey, language, region])

  return state
}

export function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}
