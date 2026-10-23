import {
  Language,
  type ILocale,
  type LocaleChangeListener,
} from '@foxycape/core/kernal'
import type { Plugin } from 'obsidian'
import supportedLanguagesJson from './supported_languages.json'
import { clearLocaleCache, loadLocaleResources } from './loadLocaleResources'
import {
  FALLBACK_LANGUAGE,
  getObsidianLocaleCode,
  resolveLocaleCode,
} from './resolveObsidianLanguage'

export class ObsidianLocale implements ILocale {
  /** Open reader views subscribe with onLanguageChange and refresh their own Vue state. */
  private readonly state = {
    language: FALLBACK_LANGUAGE,
    resource: {} as Record<string, string>,
  }
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
    if (language === this.state.language && Object.keys(this.state.resource).length > 0) {
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
    return this.applyNamed(this.state.resource[key] || defaultText, named)
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
    if (nextLanguage === this.state.language && Object.keys(this.state.resource).length > 0) {
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
    this.state.language = nextLanguage
    this.state.resource = resource
    for (const listener of this.listeners) {
      listener(nextLanguage)
    }
  }

  getCurrentLanguage(excludeRegion?: boolean): string {
    let language = this.state.language || FALLBACK_LANGUAGE
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
    this.state.language = FALLBACK_LANGUAGE
    this.state.resource = {}
    this.listeners.clear()
    clearLocaleCache()
  }
}
