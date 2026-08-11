import {
  Theme,
  type ColorMode,
  type IThemeProvider,
} from '@core/kernal'
import type { App, EventRef } from 'obsidian'
import {
  ensureCssColorAlpha,
  toResolvedCssColor,
} from './mediaTypes/pdf/colorUtils'

/** Theme name used by the Obsidian-backed provider. */
export const OBSIDIAN_THEME_NAME = 'obsidian'

type ThemeChangeListener = () => void | Promise<void>

/**
 * Maps the active Obsidian appearance (CSS variables on `document.body`)
 * into a Foxycape {@link Theme}.
 */
export class ObsidianThemeProvider implements IThemeProvider {
  private theme: Theme | undefined
  private isDisposed = false
  private app: App | null = null
  private cssChangeRef: EventRef | null = null
  private onThemeChanged: ThemeChangeListener | null = null
  private isSyncing = false
  private needsResync = false

  async initialize(): Promise<void> {
    this.ensureActive()
    // Snapshot once so open() can resolve a theme immediately.
    this.theme = this.buildThemeFromObsidian()
  }

  getThemes(): Theme[] {
    const current = this.getCurrentTheme()
    return current ? [current] : []
  }

  getTheme(themeName: string): Theme | undefined {
    if (!themeName) {
      return undefined
    }
    const current = this.getCurrentTheme()
    if (!current) {
      return undefined
    }
    // Options defaults to "default"; treat it as the Obsidian theme.
    if (
      themeName === current.name ||
      themeName === 'default' ||
      themeName === OBSIDIAN_THEME_NAME
    ) {
      return current
    }
    return undefined
  }

  getCurrentTheme(): Theme | undefined {
    if (this.isDisposed) {
      return undefined
    }
    // Always re-read so callers see the latest Obsidian appearance.
    this.theme = this.buildThemeFromObsidian()
    return this.theme
  }

  /**
   * Re-read Obsidian CSS variables (e.g. after a theme / css-change).
   */
  refresh = (): Theme => {
    this.ensureActive()
    this.theme = this.buildThemeFromObsidian()
    return this.theme
  }

  /**
   * Keep the reader theme in sync when Obsidian appearance / CSS changes.
   */
  bindLiveSync = (app: App, onThemeChanged: ThemeChangeListener): void => {
    this.ensureActive()
    this.unbindLiveSync()
    this.app = app
    this.onThemeChanged = onThemeChanged
    this.cssChangeRef = app.workspace.on('css-change', () => {
      void this.handleCssChange()
    })
  }

  unbindLiveSync = (): void => {
    if (this.app && this.cssChangeRef) {
      this.app.workspace.offref(this.cssChangeRef)
    }
    this.cssChangeRef = null
    this.app = null
    this.onThemeChanged = null
    this.needsResync = false
  }

  async dispose(): Promise<void> {
    this.unbindLiveSync()
    this.isDisposed = true
    this.theme = undefined
  }

  private handleCssChange = async (): Promise<void> => {
    if (this.isDisposed || !this.onThemeChanged) {
      return
    }
    if (this.isSyncing) {
      this.needsResync = true
      return
    }
    this.isSyncing = true
    try {
      do {
        this.needsResync = false
        this.refresh()
        await this.onThemeChanged()
      } while (this.needsResync && !this.isDisposed && this.onThemeChanged)
    } finally {
      this.isSyncing = false
    }
  }

  private ensureActive = (): void => {
    if (this.isDisposed) {
      throw new Error('ObsidianThemeProvider is disposed.')
    }
  }

  private buildThemeFromObsidian = (): Theme => {
    const defaults = new Theme()
    const body = document.body
    const styles = getComputedStyle(body)
    const isDark = body.classList.contains('theme-dark')
    const colorMode: ColorMode = isDark ? 'dark' : 'light'

    const readCssVar = (varName: string, fallback: string): string => {
      const value = styles.getPropertyValue(varName).trim()
      if (!value) {
        return fallback
      }
      // Obsidian often stores hsl()/var() on custom props; resolve to rgb() for canvas / Lab remap.
      return toResolvedCssColor(value, fallback, body)
    }

    const theme = new Theme()
    theme.name = OBSIDIAN_THEME_NAME
    theme.title = isDark ? 'Obsidian Dark' : 'Obsidian Light'
    theme.isDefault = true
    theme.enabled = true
    theme.colorMode = colorMode
    theme.themeRepresentativeColor = readCssVar(
      '--interactive-accent',
      defaults.themeRepresentativeColor,
    )
    theme.readerBackground = readCssVar(
      '--background-secondary',
      defaults.readerBackground,
    )
    theme.contentBackground = readCssVar(
      '--background-primary',
      defaults.contentBackground,
    )
    theme.contentTextColor = readCssVar(
      '--text-normal',
      defaults.contentTextColor,
    )

    theme.textMutedColor = readCssVar(
      '--text-muted',
      defaults.textMutedColor,
    )
    theme.textAccentColor = readCssVar(
      '--text-accent',
      defaults.textAccentColor,
    )
    theme.codeblockBackgroundColor = readCssVar(
      '--code-background',
      readCssVar('--background-primary-alt', defaults.codeblockBackgroundColor),
    )
    // theme.selectionBackground = readCssVar(
    //   '--text-selection',
    //   defaults.selectionBackground,
    // )
    // theme.selectionColor = readCssVar('--text-normal', defaults.selectionColor)
    // theme.columnRuleColor = readCssVar(
    //   '--background-modifier-border',
    //   defaults.columnRuleColor,
    // )
    theme.gotoTargetAnimationColor = ensureCssColorAlpha(
      readCssVar('--text-highlight-bg', defaults.gotoTargetAnimationColor),
      0.5,
      defaults.gotoTargetAnimationColor,
    )
    theme.scrollbarThumbColor = readCssVar(
      '--scrollbar-thumb-bg',
      defaults.scrollbarThumbColor,
    )
    theme.scrollbarThumbHoverColor = readCssVar(
      '--scrollbar-active-thumb-bg',
      theme.scrollbarThumbColor,
    )
    theme.scrollbarTrackColor = readCssVar(
      '--scrollbar-bg',
      readCssVar('--background-secondary', defaults.scrollbarTrackColor),
    )
    theme.borderColor = readCssVar(
      '--background-modifier-border',
      defaults.borderColor,
    )
    return theme
  }
}
