import type { Plugin } from 'obsidian'
import supportedLanguagesJson from './supported_languages.json'

type LocaleDict = Record<string, string>

/** In-memory cache for resolved locale dicts (plugin lifetime). */
const localeCache = new Map<string, LocaleDict>()

const localeModules = import.meta.glob<{ default: LocaleDict }>('./locales/*.json', {
  eager: true,
})

export const listLocaleCodes = () =>
  (supportedLanguagesJson as Array<{ code: string }>).map((item) => item.code)

const readLocaleFile = async (_plugin: Plugin, language: string): Promise<LocaleDict> => {
  const cached = localeCache.get(language)
  if (cached) {
    return cached
  }

  const mod = localeModules[`./locales/${language}.json`]
  const dict = mod?.default ?? {}
  if (!mod) {
    console.warn(
      `[Foxycape PDF] Locale "${language}" is not bundled; falling back to empty dict / en.`,
    )
  }
  localeCache.set(language, dict)
  return dict
}

/**
 * Load the requested language (+ fallback) from locales inlined into main.js.
 */
export const loadLocaleResources = async (
  plugin: Plugin,
  language: string,
  fallbackLanguage: string,
) => {
  const current = await readLocaleFile(plugin, language)
  if (language === fallbackLanguage) {
    return current
  }

  const fallback = await readLocaleFile(plugin, fallbackLanguage)
  return {
    ...fallback,
    ...current,
  }
}

/** Clear cached locale dicts (call from plugin `onunload`). */
export const clearLocaleCache = () => {
  localeCache.clear()
}
