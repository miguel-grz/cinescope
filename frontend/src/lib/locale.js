// Best-effort locale detection for first-time visitors: no IP lookups or
// permission prompts, just what the browser already exposes. Once a user
// picks a language/region manually, that choice is persisted and this
// detection never runs again (see useAppStore's persisted defaults).

// IANA zone -> ISO 3166-1 country, for browsers that report a bare
// language (e.g. "es") with no region subtag in navigator.language.
const TIMEZONE_COUNTRY = {
  'America/Bogota': 'CO',
  'America/Mexico_City': 'MX',
  'America/Tijuana': 'MX',
  'America/Argentina/Buenos_Aires': 'AR',
  'America/Santiago': 'CL',
  'America/Lima': 'PE',
  'America/Caracas': 'VE',
  'America/Guayaquil': 'EC',
  'America/La_Paz': 'BO',
  'America/Asuncion': 'PY',
  'America/Montevideo': 'UY',
  'America/Panama': 'PA',
  'America/Costa_Rica': 'CR',
  'America/Managua': 'NI',
  'America/Tegucigalpa': 'HN',
  'America/El_Salvador': 'SV',
  'America/Guatemala': 'GT',
  'America/Santo_Domingo': 'DO',
  'America/Puerto_Rico': 'US',
  'America/New_York': 'US',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Los_Angeles': 'US',
  'America/Toronto': 'CA',
  'America/Vancouver': 'CA',
  'America/Sao_Paulo': 'BR',
  'Europe/Madrid': 'ES',
  'Europe/London': 'GB',
  'Europe/Paris': 'FR',
  'Europe/Berlin': 'DE',
  'Europe/Rome': 'IT',
  'Asia/Tokyo': 'JP',
  'Asia/Seoul': 'KR',
}

function regionFromLocaleTag(tag) {
  // "es-CO" -> "CO", but reject non-country subtags like the "419" in
  // "es-419" (UN region code, not a watch-provider country TMDB understands).
  const region = tag.split('-')[1]
  return region && /^[A-Za-z]{2}$/.test(region) ? region.toUpperCase() : null
}

function regionFromTimezone() {
  try {
    return TIMEZONE_COUNTRY[Intl.DateTimeFormat().resolvedOptions().timeZone] || null
  } catch {
    return null
  }
}

export function detectRegion() {
  const tags = (typeof navigator !== 'undefined' && (navigator.languages || [navigator.language])) || []
  for (const tag of tags) {
    const region = regionFromLocaleTag(tag)
    if (region) return region
  }
  return regionFromTimezone() || 'US'
}

export function detectLanguage() {
  const tag = (typeof navigator !== 'undefined' && navigator.language) || 'es'
  return tag.toLowerCase().startsWith('en') ? 'en' : 'es'
}
