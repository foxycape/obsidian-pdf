import {
  Language,
  type ILocale,
  type LocaleChangeListener,
} from '@core/kernal'
import type { Plugin } from 'obsidian'
import supportedLanguagesJson from './supported_languages.json'
import { clearLocaleCache, loadLocaleResources } from './loadLocaleResources'
import {
  FALLBACK_LANGUAGE,
  getObsidianLocaleCode,
  resolveLocaleCode,
} from './resolveObsidianLanguage'

export class ObsidianLocale implements ILocale {
  private resource: Record<string, string> = {}
  private currentLanguage = FALLBACK_LANGUAGE
  private readonly listeners = new Set<LocaleChangeListener>()
  private supportedLanguages: Language[] | null = null
  private loadToken = 0

  constructor(private readonly plugin: Plugin) {}

  async initialize(): Promise<void> {
    await this.syncFromObsidian()
  }

  /**
   * Align with Obsidian's current UI language and reload translation resources.
   */
  async syncFromObsidian(): Promise<void> {
    const supportedCodes = this.getSupportedLanguages().map((item) => item.code)
    const language = getObsidianLocaleCode(supportedCodes)
    if (language === this.currentLanguage && Object.keys(this.resource).length > 0) {
      return
    }
    await this.changeLanguage(language)
  }

  onLanguageChange(listener: LocaleChangeListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getText(key: string, defaultText: string, named?: object): string {
    if (!key) {
      return this.applyNamed(defaultText, named)
    }
    return this.applyNamed(this.resource[key] || defaultText, named)
  }

  private applyNamed = (text: string, named?: object): string => {
    if (!named) {
      return text
    }
    let result = text
    for (const [name, value] of Object.entries(named)) {
      result = result.split(`{${name}}`).join(String(value))
    }
    return result
  }

  async changeLanguage(language: string): Promise<void> {
    const supportedCodes = this.getSupportedLanguages().map((item) => item.code)
    const nextLanguage = resolveLocaleCode(language, supportedCodes, FALLBACK_LANGUAGE)
    if (nextLanguage === this.currentLanguage && Object.keys(this.resource).length > 0) {
      return
    }
    const token = ++this.loadToken
    const resource = await loadLocaleResources(
      this.plugin,
      nextLanguage,
      FALLBACK_LANGUAGE,
    )
    if (token !== this.loadToken) {
      return
    }
    this.currentLanguage = nextLanguage
    this.resource = resource
    for (const listener of this.listeners) {
      listener(nextLanguage)
    }
  }

  getCurrentLanguage(excludeRegion?: boolean): string {
    let language = this.currentLanguage || FALLBACK_LANGUAGE
    if (excludeRegion) {
      language = language.split('-')[0] ?? language
    }
    return language
  }

  getSupportedLanguages(): Language[] {
    if (this.supportedLanguages) {
      return this.supportedLanguages
    }
    this.supportedLanguages = (supportedLanguagesJson as Array<{
      code: string
      title: string
      nativeTitle?: string
      dir?: string
    }>).map(
      (item) => new Language(item.code, item.title, item.nativeTitle ?? item.title, item.dir),
    )
    return this.supportedLanguages
  }

  async dispose(): Promise<void> {
    this.resource = {}
    this.listeners.clear()
    clearLocaleCache()
  }
}
