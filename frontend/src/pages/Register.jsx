import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'
import { useT } from '../i18n/translations'
import { PageHeader } from '../components/Grid'

export function Register() {
  const t = useT()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await useAuthStore.getState().register(email, password)
      navigate('/library')
    } catch {
      setError(t('auth_error_email_taken'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 pb-16 pt-14 sm:px-8">
      <PageHeader title={t('auth_register_title')} />
      <form onSubmit={submit} className="space-y-4">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('auth_email')}
          className="w-full rounded-full bg-surface px-4 py-2.5 text-sm outline-none ring-1 ring-line focus:ring-2 focus:ring-marquee"
        />
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('auth_password')}
          className="w-full rounded-full bg-surface px-4 py-2.5 text-sm outline-none ring-1 ring-line focus:ring-2 focus:ring-marquee"
        />
        {error && <p className="text-sm text-marquee">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-marquee px-4 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-60"
        >
          {t('auth_register_submit')}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-ink-dim">
        <Link to="/login" className="text-marquee hover:underline">{t('auth_have_account')}</Link>
      </p>
    </div>
  )
}
