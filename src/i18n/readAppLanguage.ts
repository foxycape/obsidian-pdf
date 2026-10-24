import { getLanguage, requireApiVersion } from 'obsidian'

const LEGACY_LANGUAGE_KEY = 'language'

/** Obsidian UI language. `getLanguage()` exists since 1.8.7. */
export const readAppLanguage = (): string => {
  if (requireApiVersion('1.8.7')) {
    return getLanguage() || 'en'
  }
  const stored = window.localStorage.getItem(LEGACY_LANGUAGE_KEY)
  return stored || 'en'
}
