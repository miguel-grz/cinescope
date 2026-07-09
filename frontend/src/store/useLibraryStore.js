import { create } from 'zustand'
import { apiGet, apiSend } from '../api/client'

const keyOf = (mediaType, tmdbId) => `${mediaType}:${tmdbId}`

// Normalize a TMDB item (movie/tv/list result) into the MediaRef the
// backend stores. Works for both movie (title) and tv (name) shapes.
export function toMediaRef(item, mediaType) {
  const type = mediaType || item.media_type
  return {
    tmdb_id: item.tmdb_id ?? item.id,
    media_type: type,
    title: item.title || item.name || '',
    poster_path: item.poster_path ?? null,
    backdrop_path: item.backdrop_path ?? null,
    release_date: item.release_date || item.first_air_date || null,
    vote_average: item.vote_average ?? null,
  }
}

// Mirror of the backend library. Loaded once on boot; every mutation is
// optimistic (Set lookups keep card toggles O(1)) and then synced.
export const useLibraryStore = create((set, get) => ({
  loaded: false,
  watchedKeys: new Set(),
  favoriteKeys: new Set(),
  ratings: new Map(), // key -> score
  lists: [],

  async load() {
    try {
      const [watched, favorites, ratings, lists] = await Promise.all([
        apiGet('/library/watched', {}, { fresh: true }),
        apiGet('/library/favorites', {}, { fresh: true }),
        apiGet('/library/ratings', {}, { fresh: true }),
        apiGet('/library/lists', {}, { fresh: true }),
      ])
      set({
        loaded: true,
        watchedKeys: new Set(watched.map((w) => keyOf(w.media_type, w.tmdb_id))),
        favoriteKeys: new Set(favorites.map((f) => keyOf(f.media_type, f.tmdb_id))),
        ratings: new Map(ratings.map((r) => [keyOf(r.media_type, r.tmdb_id), r.score])),
        lists,
      })
    } catch {
      set({ loaded: false })
    }
  },

  isWatched: (mediaType, tmdbId) => get().watchedKeys.has(keyOf(mediaType, tmdbId)),
  isFavorite: (mediaType, tmdbId) => get().favoriteKeys.has(keyOf(mediaType, tmdbId)),
  ratingOf: (mediaType, tmdbId) => get().ratings.get(keyOf(mediaType, tmdbId)) ?? null,

  async toggleWatched(ref) {
    const key = keyOf(ref.media_type, ref.tmdb_id)
    const next = new Set(get().watchedKeys)
    const wasWatched = next.has(key)
    wasWatched ? next.delete(key) : next.add(key)
    set({ watchedKeys: next })
    try {
      if (wasWatched) await apiSend('DELETE', `/library/watched/${ref.media_type}/${ref.tmdb_id}`)
      else await apiSend('PUT', '/library/watched', ref)
    } catch {
      get().load() // resync on failure
    }
  },

  async toggleFavorite(ref) {
    const key = keyOf(ref.media_type, ref.tmdb_id)
    const next = new Set(get().favoriteKeys)
    const wasFavorite = next.has(key)
    wasFavorite ? next.delete(key) : next.add(key)
    set({ favoriteKeys: next })
    try {
      if (wasFavorite) await apiSend('DELETE', `/library/favorites/${ref.media_type}/${ref.tmdb_id}`)
      else await apiSend('PUT', '/library/favorites', ref)
    } catch {
      get().load()
    }
  },

  async setRating(ref, score) {
    const key = keyOf(ref.media_type, ref.tmdb_id)
    const next = new Map(get().ratings)
    if (score == null) next.delete(key)
    else next.set(key, score)
    set({ ratings: next })
    try {
      if (score == null) await apiSend('DELETE', `/library/ratings/${ref.media_type}/${ref.tmdb_id}`)
      else await apiSend('PUT', '/library/ratings', { ...ref, score })
    } catch {
      get().load()
    }
  },

  async createList(name) {
    const created = await apiSend('POST', '/library/lists', { name })
    set({ lists: [...get().lists, created] })
    return created
  },

  async deleteList(listId) {
    await apiSend('DELETE', `/library/lists/${listId}`)
    set({ lists: get().lists.filter((l) => l.id !== listId) })
  },

  async addToList(listId, ref) {
    const updated = await apiSend('PUT', `/library/lists/${listId}/items`, ref)
    set({ lists: get().lists.map((l) => (l.id === listId ? updated : l)) })
  },

  async removeFromList(listId, ref) {
    await apiSend('DELETE', `/library/lists/${listId}/items/${ref.media_type}/${ref.tmdb_id}`)
    set({
      lists: get().lists.map((l) =>
        l.id === listId
          ? { ...l, items: l.items.filter((i) => !(i.tmdb_id === ref.tmdb_id && i.media_type === ref.media_type)) }
          : l
      ),
    })
  },
}))
