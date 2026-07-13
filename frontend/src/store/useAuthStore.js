import { create } from 'zustand'
import { apiGet, apiSend } from '../api/client'

// Mirrors the backend session: null user means "not logged in", not "not
// yet checked" — callers gate on `loaded` for that distinction.
export const useAuthStore = create((set) => ({
  user: null,
  loaded: false,

  async checkSession() {
    try {
      const user = await apiGet('/auth/me', {}, { fresh: true })
      set({ user, loaded: true })
    } catch {
      set({ user: null, loaded: true })
    }
  },

  async login(email, password) {
    const user = await apiSend('POST', '/auth/login', { email, password })
    set({ user })
    return user
  },

  async register(email, password) {
    const user = await apiSend('POST', '/auth/register', { email, password })
    set({ user })
    return user
  },

  async logout() {
    await apiSend('POST', '/auth/logout')
    set({ user: null })
  },
}))
