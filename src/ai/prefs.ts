import type { IStorage } from '@/storage'
import { getAiRuntime } from './runtime'
import type { ExplainDetail, TranslateEngine } from './passage/types'

const TABLE = 'ai-prefs'

export type ReplyLanguage = {
  code: string
  title: string
}

export const REPLY_LANGUAGES: ReplyLanguage[] = [
  { code: 'zh-Hans', title: '中文（简体）' },
  { code: 'zh-Hant', title: '中文（繁體）' },
  { code: 'en', title: 'English' },
  { code: 'ja', title: '日本語' },
  { code: 'ko', title: '한국어' },
  { code: 'fr', title: 'Français' },
  { code: 'de', title: 'Deutsch' },
  { code: 'es', title: 'Español' },
  { code: 'pt', title: 'Português' },
  { code: 'ru', title: 'Русский' },
  { code: 'it', title: 'Italiano' },
  { code: 'ar', title: 'العربية' },
  { code: 'vi', title: 'Tiếng Việt' },
  { code: 'th', title: 'ไทย' },
  { code: 'id', title: 'Bahasa Indonesia' },
  { code: 'tr', title: 'Türkçe' },
  { code: 'pl', title: 'Polski' },
  { code: 'nl', title: 'Nederlands' },
  { code: 'uk', title: 'Українська' },
  { code: 'hi', title: 'हिन्दी' },
]

const storageOf = (): IStorage => getAiRuntime().storage

const defaultLanguageCode = () => {
  const lang = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : 'en'
  if (lang.startsWith('zh-tw') || lang.startsWith('zh-hk') || lang.startsWith('zh-hant')) {
    return 'zh-Hant'
  }
  if (lang.startsWith('zh')) {
    return 'zh-Hans'
  }
  const hit = REPLY_LANGUAGES.find((item) => lang === item.code.toLowerCase() || lang.startsWith(item.code.toLowerCase()))
  return hit?.code ?? 'en'
}

export const languageByCode = (code: string): ReplyLanguage => {
  const found = REPLY_LANGUAGES.find((item) => item.code === code)
  return found ?? { code, title: code }
}

export const loadReplyLanguage = async (): Promise<ReplyLanguage> => {
  const stored = await storageOf().get<{ responseLanguage?: string }>(TABLE, 'chat')
  const code = stored?.responseLanguage?.trim() || defaultLanguageCode()
  return languageByCode(code)
}

export const saveReplyLanguage = async (code: string): Promise<ReplyLanguage> => {
  const language = languageByCode(code)
  await storageOf().set(TABLE, 'chat', { responseLanguage: language.code })
  return language
}

export type TranslatePrefs = {
  engine: TranslateEngine
  language: string
  quality: 'low' | 'medium'
}

export const loadTranslatePrefs = async (): Promise<TranslatePrefs> => {
  const stored = await storageOf().get<Partial<TranslatePrefs>>(TABLE, 'translate')
  return {
    engine: stored?.engine === 'ai' ? 'ai' : 'edgemt',
    language: stored?.language?.trim() || defaultLanguageCode(),
    quality: stored?.quality === 'medium' ? 'medium' : 'low',
  }
}

export const saveTranslatePrefs = async (prefs: TranslatePrefs): Promise<void> => {
  await storageOf().set(TABLE, 'translate', prefs)
}

export const loadDetailPref = async (kind: 'explain' | 'lookup'): Promise<ExplainDetail> => {
  const stored = await storageOf().get<{ detail?: ExplainDetail }>(TABLE, `${kind}-detail`)
  return stored?.detail === 'detailed' ? 'detailed' : 'brief'
}

export const saveDetailPref = async (kind: 'explain' | 'lookup', detail: ExplainDetail): Promise<void> => {
  await storageOf().set(TABLE, `${kind}-detail`, { detail })
}
