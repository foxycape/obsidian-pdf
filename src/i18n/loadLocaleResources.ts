import { normalizePath, type Plugin } from 'obsidian'
import supportedLanguagesJson from './supported_languages.json'

type LocaleDict = Record<string, string>

/** In-memory cache for locale files that were read from the plugin directory. */
const localeCache = new Map<string, LocaleDict>()

export const listLocaleCodes = () =>
  (supportedLanguagesJson as Array<{ code: string }>).map((item) => item.code)

const localePath = (plugin: Plugin, language: string) => {
  const pluginDir = plugin.manifest.dir
  if (!pluginDir) {
    return ''
  }
  return normalizePath(`${pluginDir}/locales/${language}.json`)
}

const readLocaleFile = async (plugin: Plugin, language: string): Promise<LocaleDict> => {
  const cached = localeCache.get(language)
  if (cached) {
    return cached
  }

  const path = localePath(plugin, language)
  if (!path || !(await plugin.app.vault.adapter.exists(path))) {
    console.warn(
      `[Foxycape PDF] Locale "${language}" is not on disk; falling back to English default text.`,
    )
    return {}
  }

  try {
    const dict = JSON.parse(await plugin.app.vault.adapter.read(path)) as LocaleDict
    localeCache.set(language, dict)
    return dict
  } catch (error) {
    console.warn(`[Foxycape PDF] Failed to read locale "${language}".`, error)
    return {}
  }
}

/**
 * Load the requested language and the English fallback from locales/{code}.json
 * next to the plugin. Those files arrive in locales.zip.
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
