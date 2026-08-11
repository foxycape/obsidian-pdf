import { normalizePath, type Plugin } from 'obsidian'
import supportedLanguagesJson from './supported_languages.json'

type LocaleDict = Record<string, string>

const LOCALES_DIR = 'locales'

/** In-memory cache for locale files already read from disk (plugin lifetime). */
const localeCache = new Map<string, LocaleDict>()

export const listLocaleCodes = () =>
  (supportedLanguagesJson as Array<{ code: string }>).map((item) => item.code)

const readLocaleFile = async (plugin: Plugin, language: string): Promise<LocaleDict> => {
  const cached = localeCache.get(language)
  if (cached) {
    return cached
  }

  const pluginDir = plugin.manifest.dir
  if (!pluginDir) {
    console.warn(
      '[Foxycape PDF] Plugin directory is unavailable (manifest.dir is empty); locale load skipped.',
    )
    return {}
  }

  const adapter = plugin.app.vault.adapter
  const localePath = normalizePath(`${pluginDir}/${LOCALES_DIR}/${language}.json`)
  if (!(await adapter.exists(localePath))) {
    console.warn(
      `[Foxycape PDF] Locale missing at ${localePath}. Rebuild so dist/locales/*.json are copied.`,
    )
    localeCache.set(language, {})
    return {}
  }

  try {
    const raw = await adapter.read(localePath)
    const dict = (raw ? JSON.parse(raw) : {}) as LocaleDict
    localeCache.set(language, dict)
    return dict
  } catch (error) {
    console.warn(`[Foxycape PDF] Failed to parse locale ${language}`, error)
    localeCache.set(language, {})
    return {}
  }
}

/**
 * Load only the requested language (+ fallback) from dist/locales at runtime.
 * Same pattern as pdf.worker.min.mjs: kept out of main.js, read via vault adapter.
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
