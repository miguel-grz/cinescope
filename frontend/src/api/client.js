// Thin fetch wrapper over the CineScope backend with an in-module cache
// for GETs (deduplicates identical requests across components).
const cache = new Map()
const MAX_CACHE = 200

export async function apiGet(path, params = {}, { signal, fresh = false } = {}) {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ).toString()
  const url = `/api${path}${query ? `?${query}` : ''}`

  if (!fresh && cache.has(url)) return cache.get(url)

  const response = await fetch(url, { signal })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.detail || `Request failed (${response.status})`)
  }
  const data = await response.json()
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value)
  cache.set(url, data)
  return data
}

export async function apiSend(method, path, body) {
  const response = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok && response.status !== 204) {
    const detail = await response.json().catch(() => ({}))
    throw new Error(detail.detail || `Request failed (${response.status})`)
  }
  return response.status === 204 ? null : response.json()
}

export const imageUrl = (path, size = 'w342') =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : null
