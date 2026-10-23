import {
  PluginSettingTab,
  Setting,
  type App,
  type ButtonComponent,
  type DropdownComponent,
  type SettingDefinitionItem,
  type TextComponent,
} from 'obsidian'
import { debounce } from '@foxycape/core/kernal/web/debounce'
import { ensureLocalesPack, hasLocalesPack } from '@/assets/ensureRuntimeAssets'
import { getObsidianLocaleCode } from '@/i18n/resolveObsidianLanguage'
import type { PdfUsagePoint } from '@/views/pdfBundleModule'
import {
  LICENSE_INPUT_DEBOUNCE_MS,
  LICENSE_PURCHASE_URL,
  type LicenseValidationOutcome,
} from '@/license'
import type { FoxycapePdfPlugin } from '@/plugin/FoxycapePdfPlugin'
import { showConfirmModal } from '@/ui/ConfirmModal'
import { loadPdfLib } from '@/views/loadPdfModule'
import { loadReaderBundle } from '@/views/loadReaderBundle'

const formatUsageDuration = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

type UsageBar = {
  duration: string
  total: number
}

const formatTokenAmount = (count: number): string => {
  if (!Number.isFinite(count) || count <= 0) {
    return '0'
  }
  if (count >= 1_000_000) {
    const rounded = Math.round((count / 1_000_000) * 10) / 10
    return (Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)) + 'M'
  }
  if (count >= 1000) {
    const rounded = Math.round((count / 1000) * 10) / 10
    return (Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)) + 'K'
  }
  return String(Math.round(count))
}

const usageTotal = (point: PdfUsagePoint) =>
  point.inputTokenCount + point.outputTokenCount + point.cacheTokenCount

/** One bar per day. Rows that share a date are added together. */
const toUsageBars = (points: PdfUsagePoint[]): UsageBar[] => {
  const order: string[] = []
  const totals = new Map<string, number>()
  for (const point of points) {
    const current = totals.get(point.duration)
    if (current === undefined) {
      order.push(point.duration)
      totals.set(point.duration, usageTotal(point))
    } else {
      totals.set(point.duration, current + usageTotal(point))
    }
  }
  return order.map((duration) => ({
    duration,
    total: totals.get(duration) ?? 0,
  }))
}

/** Last 7 local days, including today. All counts stay at 0. */
const zeroUsagePoints = (): PdfUsagePoint[] => {
  const today = new Date()
  const points: PdfUsagePoint[] = []
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(today)
    date.setDate(today.getDate() - offset)
    points.push({
      duration: formatUsageDuration(date),
      inputTokenCount: 0,
      outputTokenCount: 0,
      cacheTokenCount: 0,
    })
  }
  return points
}

export class FoxycapePdfSettingTab extends PluginSettingTab {
  private licenseStatusEl: HTMLElement | null = null
  private usageHostEl: HTMLElement | null = null
  private licenseInput: TextComponent | null = null
  private licenseActionButton: ButtonComponent | null = null
  private isLicenseChecking = false
  private isLicenseUnbinding = false
  private lastOutcome: LicenseValidationOutcome | null = null
  private lastUnbindError: string | null = null
  private usageRequestId = 0

  private readonly debouncedValidateLicense = debounce((value: string) => {
    void this.applyLicenseInput(value)
  }, LICENSE_INPUT_DEBOUNCE_MS)

  constructor(
    app: App,
    private readonly plugin: FoxycapePdfPlugin,
  ) {
    super(app, plugin)
  }

  /**
   * Obsidian 1.13+: renders the tab and indexes settings for global search.
   * Keep in sync with {@link display} for older app versions.
   */
  getSettingDefinitions = (): SettingDefinitionItem[] => [
    {
      name: this.plugin.t(
        'plugin_settings_use_as_default_name',
        'Use as default PDF viewer',
      ),
      desc: this.plugin.t(
        'plugin_settings_use_as_default_desc',
        'When enabled, opening a .pdf file uses Foxycape PDF instead of Obsidian’s built-in viewer. You can still open with Foxycape from the command palette or file menu when this is off.',
      ),
      render: (setting) => {
        this.bindDefaultViewerToggle(setting)
      },
    },
    {
      name: this.plugin.t('plugin_settings_language_name', 'Language'),
      desc: this.plugin.t(
        'plugin_settings_language_desc',
        'Language used by Foxycape PDF. Defaults to Obsidian’s language, or English when that language is not available.',
      ),
      render: (setting) => {
        this.bindLanguageDropdown(setting)
      },
    },

    {
      type: 'group',
      heading: this.plugin.t('plugin_settings_license_heading', 'License'),
      items: [
        {
          name: this.plugin.t('plugin_settings_license_name', 'License key'),
          render: (setting) => {
            this.bindLicenseSetting(setting)
          },
        },
      ],
    },
    {
      type: 'group',
      heading: this.plugin.t('plugin_settings_ai_usage_heading', 'AI usage'),
      items: [
        {
          name: this.plugin.t('plugin_settings_ai_usage_heading', 'AI usage'),
          render: (setting) => {
            this.bindAiUsageSetting(setting)
          },
        },
      ],
    },
  ]

  /** Pre-1.13 fallback; skipped when getSettingDefinitions() returns a non-empty array. */
  display = () => {
    void this.plugin.syncLocaleIfNeeded().then(() => {
      const { containerEl } = this
      containerEl.empty()
      this.clearLicenseUiRefs()
      this.usageHostEl = null

      new Setting(containerEl)
        .setName(this.plugin.t('plugin_settings_title', 'Foxycape PDF'))
        .setHeading()

      const defaultViewerSetting = new Setting(containerEl)
        .setName(
          this.plugin.t(
            'plugin_settings_use_as_default_name',
            'Use as default PDF viewer',
          ),
        )
        .setDesc(
          this.plugin.t(
            'plugin_settings_use_as_default_desc',
            'When enabled, opening a .pdf file uses Foxycape PDF instead of Obsidian’s built-in viewer. You can still open with Foxycape from the command palette or file menu when this is off.',
          ),
        )
      this.bindDefaultViewerToggle(defaultViewerSetting)

      const languageSetting = new Setting(containerEl)
        .setName(this.plugin.t('plugin_settings_language_name', 'Language'))
        .setDesc(
          this.plugin.t(
            'plugin_settings_language_desc',
            'Language used by Foxycape PDF. Defaults to Obsidian’s language, or English when that language is not available.',
          ),
        )
      this.bindLanguageDropdown(languageSetting)

      new Setting(containerEl)
        .setName(this.plugin.t('plugin_settings_license_heading', 'License'))
        .setHeading()

      const licenseSetting = new Setting(containerEl)
        .setName(
          this.plugin.t('plugin_settings_license_name', 'License key'),
        )
        .setDesc('')
      this.bindLicenseSetting(licenseSetting)

      new Setting(containerEl)
        .setName(this.plugin.t('plugin_settings_ai_usage_heading', 'AI usage'))
        .setHeading()

      this.bindAiUsageSetting(new Setting(containerEl))
    })
  }

  private clearLicenseUiRefs = () => {
    this.licenseStatusEl = null
    this.licenseInput = null
    this.licenseActionButton = null
  }

  private bindDefaultViewerToggle = (setting: Setting) => {
    setting.addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.useAsDefaultPdfViewer).onChange((value) => {
        void this.plugin.setUseAsDefaultPdfViewer(value)
      })
    })
  }

  private bindLicenseSetting = (setting: Setting) => {
    this.clearLicenseUiRefs()
    setting.settingEl.addClass('foxycape-pdf-license-setting')
    setting
      .addText((text) => {
        this.licenseInput = text
        text
          .setPlaceholder(
            this.plugin.t(
              'plugin_settings_license_placeholder',
              'Enter your license key',
            ),
          )
          .setValue(this.plugin.settings.license)
          .onChange((value) => {
            if (this.plugin.settings.licenseValid || text.inputEl.readOnly) {
              return
            }
            this.isLicenseChecking = value.trim().length > 0
            this.lastOutcome = null
            this.lastUnbindError = null
            this.refreshLicenseStatus()
            this.debouncedValidateLicense(value)
          })
        text.inputEl.addClass('foxycape-pdf-license-input')
        text.inputEl.setAttr('spellcheck', 'false')
        text.inputEl.setAttr('autocomplete', 'off')
      })
      .addButton((button) => {
        this.licenseActionButton = button
        button.buttonEl.addClass('clickable-icon')
        button.onClick(() => {
          if (this.plugin.settings.licenseValid) {
            this.promptUnbindLicense()
            return
          }
          window.open(LICENSE_PURCHASE_URL, '_blank')
        })
      })

    setting.descEl.createDiv({
      cls: 'foxycape-pdf-license-hint',
      text: this.plugin.t(
        'plugin_settings_license_hint',
        'Only links your AI usage. Enter it on another device — no sign-in.',
      ),
    })
    this.licenseStatusEl = setting.descEl.createDiv({
      cls: 'foxycape-pdf-license-status',
    })
    this.refreshLicenseInputReadonly()
    this.refreshLicenseActionButton()
    this.refreshLicenseStatus()
  }

  private bindAiUsageSetting = (setting: Setting) => {
    setting.settingEl.addClass('foxycape-pdf-ai-usage-setting')
    setting.nameEl.hide()
    setting.controlEl.hide()
    this.usageHostEl = setting.descEl
    this.renderUsageSection()
  }

  private languageDropdownToken = 0

  private bindLanguageDropdown = (setting: Setting) => {
    const languages = this.plugin.locale.getSupportedLanguages()
    const codes = languages.map((item) => item.code)
    const saved = this.plugin.settings.language
    const selected = saved && codes.includes(saved) ? saved : getObsidianLocaleCode(codes)
    const token = ++this.languageDropdownToken
    setting.addDropdown((dropdown) => {
      for (const language of languages) {
        dropdown.addOption(language.code, language.nativeTitle || language.title || language.code)
      }
      dropdown.setValue(selected)
      dropdown.onChange((value) => {
        void this.plugin.setLanguage(value).then(() => {
          this.refreshSettings()
        })
      })
      void this.prepareLanguageDropdown(setting, dropdown, token)
    })
  }

  /** Enable the dropdown when locales are already installed. Otherwise download without blocking the page. */
  private prepareLanguageDropdown = async (
    setting: Setting,
    dropdown: DropdownComponent,
    token: number,
  ) => {
    if (await hasLocalesPack(this.plugin)) {
      return
    }
    if (token !== this.languageDropdownToken) {
      return
    }
    dropdown.setDisabled(true)
    setting.settingEl.addClass('foxycape-pdf-language-pending')
    const spinner = setting.controlEl.createDiv({ cls: 'foxycape-pdf-language-spinner' })
    const stopWaiting = () => {
      spinner.remove()
      setting.settingEl.removeClass('foxycape-pdf-language-pending')
    }
    try {
      await ensureLocalesPack(this.plugin, { t: this.plugin.t })
    } catch (error) {
      spinner.remove()
      if (token === this.languageDropdownToken) {
        console.warn('[Foxycape PDF] language pack download failed; using English', error)
        return
      }
      setting.settingEl.removeClass('foxycape-pdf-language-pending')
      return
    }
    if (token !== this.languageDropdownToken) {
      stopWaiting()
      return
    }
    try {
      const saved = this.plugin.savedLanguageCode()
      if (saved) {
        await this.plugin.setLanguage(saved)
      } else {
        await this.plugin.syncLocaleIfNeeded()
      }
    } catch (error) {
      console.warn('[Foxycape PDF] failed to load downloaded language pack', error)
    }
    if (token !== this.languageDropdownToken) {
      stopWaiting()
      return
    }
    stopWaiting()
    this.refreshSettings()
  }

  /** Obsidian 1.13 redraws from getSettingDefinitions(); older versions use display(). */
  private refreshSettings = () => {
    if (typeof this.update === 'function') {
      this.update()
      return
    }
    this.display()
  }

  private applyLicenseInput = async (value: string) => {
    this.isLicenseChecking = true
    this.lastUnbindError = null
    this.refreshLicenseStatus()
    const outcome = await this.plugin.licenseService.setLicense(value)
    this.isLicenseChecking = false
    this.lastOutcome = outcome
    this.refreshLicenseInputReadonly()
    this.refreshLicenseActionButton()
    this.refreshLicenseStatus()
  }

  private promptUnbindLicense = () => {
    if (this.isLicenseUnbinding) {
      return
    }
    showConfirmModal(this.app, {
      title: this.plugin.t(
        'plugin_settings_license_unbind_confirm_title',
        'Unbind license',
      ),
      message: this.plugin.t(
        'plugin_settings_license_unbind_confirm_message',
        'Unbind this license from this device? You can enter the key again later.',
      ),
      confirmText: this.plugin.t(
        'plugin_settings_license_unbind_confirm',
        'Unbind',
      ),
      cancelText: this.plugin.t(
        'plugin_settings_license_unbind_cancel',
        'Cancel',
      ),
      isWarning: true,
      onConfirm: () => {
        void this.runUnbindLicense()
      },
    })
  }

  private runUnbindLicense = async () => {
    this.isLicenseUnbinding = true
    this.lastUnbindError = null
    this.refreshLicenseStatus()
    const outcome = await this.plugin.licenseService.unbindLicense()
    this.isLicenseUnbinding = false

    if (outcome.kind === 'success' || outcome.kind === 'empty') {
      this.lastOutcome = null
      this.lastUnbindError = null
      this.licenseInput?.setValue('')
      this.refreshLicenseInputReadonly()
      this.refreshLicenseActionButton()
      this.refreshLicenseStatus()
      return
    }

    this.lastUnbindError =
      outcome.kind === 'failed'
        ? this.plugin.t(
            'plugin_settings_license_unbind_failed',
            'Failed to unbind: {message}',
            { message: outcome.message },
          )
        : this.plugin.t(
            'plugin_settings_license_unbind_network_error',
            'Could not reach the license server. Unbind was not completed.',
          )
    this.refreshLicenseStatus()
  }

  private refreshLicenseInputReadonly = () => {
    const inputEl = this.licenseInput?.inputEl
    if (!inputEl) {
      return
    }
    inputEl.readOnly = this.plugin.settings.licenseValid
  }

  private refreshLicenseActionButton = () => {
    const button = this.licenseActionButton
    if (button === null) {
      return
    }

    // Clear style modifiers before applying the next state.
    // Newer Obsidian maps deprecated setWarning() → mod-destructive; clearing only
    // mod-warning left the Buy button red after Unbind.
    button.removeCta()
    button.buttonEl.removeClass('mod-warning', 'mod-destructive')

    if (this.plugin.settings.licenseValid) {
      button.setButtonText(
        this.plugin.t('plugin_settings_license_unbind', 'Unbind'),
      )
      // Default button style (not warning / destructive / CTA).
      return
    }

    button.setButtonText(
      this.plugin.t('plugin_settings_license_purchase', 'Get a license'),
    )
    button.setCta()
  }

  private refreshLicenseStatus = () => {
    const el = this.licenseStatusEl
    if (!el) {
      this.renderUsageSection()
      return
    }
    el.empty()

    if (this.isLicenseUnbinding) {
      el.createDiv({
        text: this.plugin.t(
          'plugin_settings_license_unbinding',
          'Unbinding license…',
        ),
      })
    } else if (this.isLicenseChecking) {
      el.createDiv({
        text: this.plugin.t(
          'plugin_settings_license_checking',
          'Validating license…',
        ),
      })
    } else {
      const { settings } = this.plugin

      if (this.lastUnbindError) {
        el.createDiv({ text: this.lastUnbindError })
      }

      if (settings.licenseValid) {
        el.createDiv({
          cls: 'foxycape-pdf-license-applied',
          text: settings.licenseLifetime
            ? this.plugin.t(
                'plugin_settings_license_applied_lifetime',
                'License applied (lifetime).',
              )
            : this.plugin.t(
                'plugin_settings_license_applied',
                'License applied.',
              ),
        })
      } else if (this.lastOutcome?.kind === 'invalid' && settings.license.trim()) {
        el.createDiv({
          text: this.plugin.t(
            'plugin_settings_license_invalid',
            'Invalid license: {message}',
            { message: this.lastOutcome.message },
          ),
        })
      } else if (this.lastOutcome?.kind === 'network_error') {
        el.createDiv({
          text: this.plugin.t(
            'plugin_settings_license_network_error',
            'Could not reach the license server. Your previous status is kept.',
          ),
        })
      }
    }

    this.renderUsageSection()
  }

  private renderUsageSection = () => {
    const el = this.usageHostEl
    if (!el) {
      return
    }
    el.empty()
    const balanceEl = el.createDiv({ cls: 'foxycape-pdf-ai-balance' })
    el.createDiv({
      cls: 'foxycape-pdf-ai-usage-hint',
      text: this.plugin.t(
        'plugin_settings_ai_usage_official_hint',
        'Only official model usage is counted. Your own API key is not included.',
      ),
    })
    const chartEl = el.createDiv({ cls: 'foxycape-pdf-ai-usage' })
    if (!this.plugin.settings.licenseValid) {
      this.usageRequestId += 1
      balanceEl.setText(
        this.plugin.t('plugin_settings_ai_balance', 'AI usage balance: {balance}', {
          balance: formatTokenAmount(0),
        }),
      )
      this.drawUsageChart(chartEl, zeroUsagePoints())
      return
    }
    const requestId = ++this.usageRequestId
    void this.renderAiUsage(balanceEl, chartEl, requestId)
  }

  private renderAiUsage = async (
    balanceEl: HTMLElement,
    chartEl: HTMLElement,
    requestId: number,
  ) => {
    const unavailable = () => {
      if (requestId !== this.usageRequestId) {
        return
      }
      balanceEl.setText(
        this.plugin.t('plugin_settings_ai_usage_unavailable', 'Usage is unavailable right now'),
      )
    }
    try {
      await loadPdfLib(this.plugin)
      const bundle = await loadReaderBundle(this.plugin)
      if (requestId !== this.usageRequestId) {
        return
      }
      const user = await bundle.getLicenseAiUser(this.plugin.apiClient, this.plugin.settings.license)
      if (requestId !== this.usageRequestId) {
        return
      }
      if (!user?.accessToken) {
        unavailable()
        return
      }
      const balance = formatTokenAmount(user.availableAITokenCount ?? 0)
      balanceEl.setText(
        this.plugin.t('plugin_settings_ai_balance', 'AI usage balance: {balance}', { balance }),
      )
      const points = await bundle.loadLicenseAiUsage(this.plugin.apiClient, user.accessToken)
      if (requestId !== this.usageRequestId) {
        return
      }
      chartEl.empty()
      if (!points) {
        chartEl.setText(
          this.plugin.t('plugin_settings_ai_usage_unavailable', 'Usage is unavailable right now'),
        )
        return
      }
      this.drawUsageChart(chartEl, points)
    } catch (error) {
      console.warn('[Foxycape PDF] failed to load AI usage', error)
      unavailable()
    }
  }

  private drawUsageChart = (chartEl: HTMLElement, points: PdfUsagePoint[]) => {
    const usageBars = toUsageBars(points)
    chartEl.createDiv({
      cls: 'foxycape-pdf-ai-usage__title',
      text: this.plugin.t('plugin_settings_ai_usage_title', 'Last 7 days'),
    })
    const max = Math.max(1, ...usageBars.map((bar) => bar.total))
    const bars = chartEl.createDiv({ cls: 'foxycape-pdf-ai-usage__bars' })
    const detailEl = chartEl.createDiv({ cls: 'foxycape-pdf-ai-usage__detail' })
    const formatDay = (duration: string) =>
      duration.length === 8 ? `${duration.slice(4, 6)}/${duration.slice(6)}` : duration
    const latestUsed = [...usageBars].reverse().find((bar) => bar.total > 0)
    let selectedDuration = latestUsed?.duration ?? usageBars.at(-1)?.duration ?? ''
    let hoveredDuration = ''
    const columns: { duration: string; button: HTMLElement; bar: HTMLElement }[] = []

    const paint = () => {
      const activeDuration = hoveredDuration || selectedDuration
      for (const column of columns) {
        column.button.toggleClass('is-active', column.duration === activeDuration)
      }
      const day = usageBars.find((bar) => bar.duration === activeDuration)
      detailEl.setText(
        day
          ? this.plugin.t('plugin_settings_ai_usage_day', '{date} · {tokens}', {
              date: formatDay(day.duration),
              tokens: formatTokenAmount(day.total),
            })
          : '',
      )
    }

    for (const usageBar of usageBars) {
      const button = bars.createEl('button', { cls: 'foxycape-pdf-ai-usage__col' })
      button.type = 'button'
      button.setAttr('title', formatTokenAmount(usageBar.total))
      const track = button.createDiv({ cls: 'foxycape-pdf-ai-usage__track' })
      const bar = track.createDiv({ cls: 'foxycape-pdf-ai-usage__bar' })
      if (usageBar.total > 0) {
        bar.addClass('foxycape-pdf-ai-usage__bar--used')
      }
      const heightRem =
        usageBar.total <= 0 ? 0.125 : Math.max(0.5, (usageBar.total / max) * 6)
      bar.style.height = `${Math.round(heightRem * 1000) / 1000}rem`
      button.createDiv({
        cls: 'foxycape-pdf-ai-usage__label',
        text: formatDay(usageBar.duration),
      })
      button.addEventListener('click', () => {
        selectedDuration = usageBar.duration
        paint()
      })
      button.addEventListener('mouseenter', () => {
        hoveredDuration = usageBar.duration
        paint()
      })
      button.addEventListener('mouseleave', () => {
        hoveredDuration = ''
        paint()
      })
      columns.push({ duration: usageBar.duration, button, bar })
    }
    paint()
  }
}
