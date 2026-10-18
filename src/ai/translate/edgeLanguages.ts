import { getLanguage } from 'obsidian'
import { tryGetAiRuntime } from '../runtime'
import supportedLanguagesJson from '@/i18n/supported_languages.json'

const LANGUAGES_URL =
  'https://api.cognitive.microsofttranslator.com/languages?api-version=3.0&scope=translation'
const TABLE = 'translator-languages'
const UNSUPPORTED = new Set(['sr-Cyrl', 'sr-Latn'])

export type ListedLanguage = {
  code: string
  title: string
  nativeTitle: string
}

type LanguageCache = {
  languages: ListedLanguage[]
}

let memory: { ui: string; languages: ListedLanguage[] } | null = null

const fallbackLanguages = (): ListedLanguage[] =>
  (supportedLanguagesJson as Array<{ code: string; title: string; nativeTitle?: string }>).map(
    (item) => ({
      code: item.code,
      title: item.title,
      nativeTitle: item.nativeTitle || item.title,
    }),
  )

const asLanguages = (value: unknown): ListedLanguage[] => {
  const translation = (value as { translation?: Record<string, { name?: string; nativeName?: string }> } | null)
    ?.translation
  if (!translation || typeof translation !== 'object') {
    return []
  }
  const languages = Object.entries(translation)
    .filter(([code]) => !UNSUPPORTED.has(code))
    .map(([code, item]) => ({
      code,
      title: item?.name?.trim() || code,
      nativeTitle: item?.nativeName?.trim() || item?.name?.trim() || code,
    }))
    .sort((a, b) => a.title.localeCompare(b.title))
  return languages
}

export const loadEdgeLanguages = async (): Promise<ListedLanguage[]> => {
  const ui = getLanguage() || 'en'
  if (memory?.ui === ui && memory.languages.length > 0) {
    return memory.languages
  }
  const runtime = tryGetAiRuntime()
  if (runtime) {
    const cached = await runtime.storage.get<LanguageCache>(TABLE, ui)
    if (cached?.languages?.length) {
      memory = { ui, languages: cached.languages }
      return cached.languages
    }
  }
  try {
    const response = await fetch(LANGUAGES_URL, {
      headers: { 'Accept-Language': ui, Accept: 'application/json' },
    })
    if (!response.ok) {
      return fallbackLanguages()
    }
    const languages = asLanguages(await response.json())
    if (!languages.length) {
      return fallbackLanguages()
    }
    memory = { ui, languages }
    if (runtime) {
      await runtime.storage.set(TABLE, ui, { languages } satisfies LanguageCache)
    }
    return languages
  } catch {
    return fallbackLanguages()
  }
}

export const findListedLanguage = (languages: ListedLanguage[], code: string): ListedLanguage => {
  const found = languages.find((item) => item.code === code)
  return found ?? { code, title: code, nativeTitle: '' }
}
