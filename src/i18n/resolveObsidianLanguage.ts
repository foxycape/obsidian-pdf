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

  const [primary, region] = lower.split('-')
  if (primary === 'en') {
    return findSupportedCode(supportedCodes, ['en-us', 'en']) ?? fallback
  }
  if (primary === 'pt') {
    if (region === 'br') {
      return findSupportedCode(supportedCodes, ['pt-br']) ?? fallback
    }
    return findSupportedCode(supportedCodes, ['pt-pt', 'pt']) ?? fallback
  }

  const byPrefix = supportedCodes.find((code) => code.toLowerCase() === primary)
  return byPrefix ?? fallback
}

const findSupportedCode = (supportedCodes: readonly string[], candidates: readonly string[]) => {
  for (const candidate of candidates) {
    const found = supportedCodes.find((code) => code.toLowerCase() === candidate)
    if (found) {
      return found
    }
  }
  return undefined
}

export const getObsidianLocaleCode = (supportedCodes: readonly string[]) =>
  resolveLocaleCode(getLanguage(), supportedCodes, FALLBACK_LANGUAGE)

export { FALLBACK_LANGUAGE }
