import { imageUrl } from '../api/client'
import { useAppStore } from '../store/useAppStore'
import { useT } from '../i18n/translations'

const REGION_NAMES = {
  CO: 'Colombia', MX: 'México', AR: 'Argentina', CL: 'Chile', PE: 'Perú',
  EC: 'Ecuador', VE: 'Venezuela', BR: 'Brasil', US: 'United States',
  ES: 'España', GB: 'United Kingdom', FR: 'France', DE: 'Deutschland',
  IT: 'Italia', CA: 'Canada', JP: '日本', KR: '한국',
}

// Streaming availability grouped by offer type, with a country selector.
// Data comes from TMDB's watch/providers (sourced from JustWatch).
export function WatchProviders({ providers }) {
  const t = useT()
  const { region, setRegion } = useAppStore()
  if (!providers) return null

  const groups = [
    { key: 'flatrate', label: t('providers_stream') },
    { key: 'rent', label: t('providers_rent') },
    { key: 'buy', label: t('providers_buy') },
  ].filter((g) => providers[g.key]?.length)

  const regionOptions = providers.available_regions?.length
    ? providers.available_regions
    : Object.keys(REGION_NAMES)

  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-baseline gap-3">
          <span className="h-[3px] w-6 self-center bg-marquee" aria-hidden="true" />
          <span className="display text-xl sm:text-2xl">{t('where_to_watch')}</span>
        </h2>
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          aria-label={t('providers_region')}
          className="rounded-full bg-surface px-4 py-1.5 text-xs font-semibold outline-none ring-1 ring-line hover:text-marquee focus-visible:ring-2 focus-visible:ring-marquee"
        >
          {regionOptions.map((code) => (
            <option key={code} value={code}>
              {REGION_NAMES[code] || code}
            </option>
          ))}
        </select>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-ink-dim">{t('providers_none')}</p>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.key} className="flex flex-wrap items-center gap-3">
              <span className="credit-label w-28 shrink-0">{group.label}</span>
              {providers[group.key].map((p) => (
                <a
                  key={p.provider_id}
                  href={providers.link}
                  target="_blank"
                  rel="noreferrer"
                  title={p.provider_name}
                  className="transition-transform hover:scale-110"
                >
                  <img
                    src={imageUrl(p.logo_path, 'w92')}
                    alt={p.provider_name}
                    className="h-11 w-11 rounded-xl shadow ring-1 ring-line"
                    loading="lazy"
                  />
                </a>
              ))}
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-[11px] text-ink-dim">{t('providers_tmdb_note')}</p>
    </section>
  )
}
