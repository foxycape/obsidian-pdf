import { getLanguage } from 'obsidian'

const FALLBACK_LANGUAGE = 'en'

/**
 * Resolve Obsidian `getLanguage()` to a locale file name.
 * Locale files use the same codes as Obsidian (e.g. `zh`, `zh-TW`, `pt-BR`).
 */
export const resolveLocaleCode = (
  language: string,
  supportedCodes: readonly string[],
  fallback = FALLBACK_LANGUAGE,
) => {
  if (!language) {
    return fallback
  }
  if (supportedCodes.includes(language)) {
    return language
  }

  const lower = language.replace(/_/g, '-').toLowerCase()
  const caseInsensitive = supportedCodes.find((code) => code.toLowerCase() === lower)
  if (caseInsensitive) {
    return caseInsensitive
  }

  const prefix = language.replace(/_/g, '-').split('-')[0] ?? language
  const byPrefix = supportedCodes.find(
    (code) => code === prefix || code.toLowerCase() === prefix.toLowerCase(),
  )
  return byPrefix ?? fallback
}

export const getObsidianLocaleCode = (supportedCodes: readonly string[]) =>
  resolveLocaleCode(getLanguage(), supportedCodes, FALLBACK_LANGUAGE)

export { FALLBACK_LANGUAGE }
