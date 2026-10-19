import {
  PluginSettingTab,
  Setting,
  type App,
  type ButtonComponent,
  type SettingDefinitionItem,
  type TextComponent,
} from 'obsidian'
import { debounce } from '@foxycape/core/kernal/web/debounce'
import { formatTokenAmount } from '@/ai/formatTokenAmount'
import { getLicenseAiUser, loadLicenseAiUsage, type AiUsagePoint } from '@/ai/licenseSession'
import { tryGetAiRuntime } from '@/ai/runtime'
import {
  LICENSE_INPUT_DEBOUNCE_MS,
  LICENSE_PURCHASE_URL,
  type LicenseValidationOutcome,
} from '@/license'
import type { FoxycapePdfPlugin } from '@/plugin/FoxycapePdfPlugin'
import { showConfirmModal } from '@/ui/ConfirmModal'

export class FoxycapePdfSettingTab extends PluginSettingTab {
  private licenseStatusEl: HTMLElement | null = null
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
  ]

  /** Pre-1.13 fallback; skipped when getSettingDefinitions() returns a non-empty array. */
  display = () => {
    void this.plugin.syncLocaleIfNeeded().then(() => {
      const { containerEl } = this
      containerEl.empty()
      this.clearLicenseUiRefs()

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

      new Setting(containerEl)
        .setName(this.plugin.t('plugin_settings_license_heading', 'License'))
        .setHeading()

      const licenseSetting = new Setting(containerEl)
        .setName(
          this.plugin.t('plugin_settings_license_name', 'License key'),
        )
        .setDesc('')
      this.bindLicenseSetting(licenseSetting)
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

  private applyLicenseInput = async (value: string) => {
    this.isLicenseChecking = true
    this.lastUnbindError = null
    this.refreshLicenseStatus()
    try {
      // License API needs signer from the embedded pack, not remote cmaps/fonts.
      await this.plugin.ensureEmbeddedRuntimeAssets()
    } catch (error) {
      this.isLicenseChecking = false
      this.lastOutcome = {
        kind: 'network_error',
        message: error instanceof Error ? error.message : String(error),
      }
      this.refreshLicenseStatus()
      return
    }
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
    try {
      await this.plugin.ensureEmbeddedRuntimeAssets()
    } catch (error) {
      this.isLicenseUnbinding = false
      this.lastUnbindError =
        error instanceof Error ? error.message : String(error)
      this.refreshLicenseStatus()
      return
    }
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
      this.plugin.t('plugin_settings_license_purchase', 'Buy license'),
    )
    button.setCta()
  }

  private refreshLicenseStatus = () => {
    const el = this.licenseStatusEl
    if (!el) {
      return
    }
    el.empty()

    if (this.isLicenseUnbinding) {
      el.setText(
        this.plugin.t(
          'plugin_settings_license_unbinding',
          'Unbinding license…',
        ),
      )
      return
    }

    if (this.isLicenseChecking) {
      el.setText(
        this.plugin.t(
          'plugin_settings_license_checking',
          'Validating license…',
        ),
      )
      return
    }

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
      const balanceEl = el.createDiv({ cls: 'foxycape-pdf-ai-balance' })
      const chartEl = el.createDiv({ cls: 'foxycape-pdf-ai-usage' })
      const requestId = ++this.usageRequestId
      void this.renderAiUsage(balanceEl, chartEl, requestId)
      return
    }

    if (this.lastOutcome?.kind === 'invalid' && settings.license.trim()) {
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

  private renderAiUsage = async (
    balanceEl: HTMLElement,
    chartEl: HTMLElement,
    requestId: number,
  ) => {
    const runtime = tryGetAiRuntime()
    if (!runtime) {
      return
    }
    const user = await getLicenseAiUser(runtime.apiClient, runtime.getLicense())
    if (requestId !== this.usageRequestId) {
      return
    }
    if (!user?.accessToken) {
      balanceEl.setText(
        this.plugin.t('plugin_settings_ai_usage_unavailable', 'Usage is unavailable right now'),
      )
      return
    }
    const balance = formatTokenAmount(user.availableAITokenCount ?? 0)
    balanceEl.setText(
      this.plugin.t('plugin_settings_ai_balance', 'AI usage balance: {balance}', { balance }),
    )
    const points = await loadLicenseAiUsage(runtime.apiClient, user.accessToken)
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
  }

  private drawUsageChart = (chartEl: HTMLElement, points: AiUsagePoint[]) => {
    chartEl.createDiv({
      cls: 'foxycape-pdf-ai-usage__title',
      text: this.plugin.t('plugin_settings_ai_usage_title', 'Last 7 days'),
    })
    const max = Math.max(
      1,
      ...points.map((point) => point.inputTokenCount + point.outputTokenCount + point.cacheTokenCount),
    )
    const bars = chartEl.createDiv({ cls: 'foxycape-pdf-ai-usage__bars' })
    for (const point of points) {
      const total = point.inputTokenCount + point.outputTokenCount + point.cacheTokenCount
      const column = bars.createDiv({ cls: 'foxycape-pdf-ai-usage__col' })
      const stack = column.createDiv({ cls: 'foxycape-pdf-ai-usage__stack' })
      stack.style.height = `${Math.max(2, Math.round((total / max) * 56))}px`
      const addSegment = (count: number, cls: string) => {
        if (count <= 0 || total <= 0) {
          return
        }
        const segment = stack.createDiv({ cls: `foxycape-pdf-ai-usage__seg ${cls}` })
        segment.style.flexGrow = String(count)
      }
      addSegment(point.outputTokenCount, 'foxycape-pdf-ai-usage__seg--output')
      addSegment(point.inputTokenCount, 'foxycape-pdf-ai-usage__seg--input')
      addSegment(point.cacheTokenCount, 'foxycape-pdf-ai-usage__seg--cache')
      column.createDiv({
        cls: 'foxycape-pdf-ai-usage__label',
        text: point.duration.length === 8 ? `${point.duration.slice(4, 6)}/${point.duration.slice(6)}` : point.duration,
      })
    }
    const legend = chartEl.createDiv({ cls: 'foxycape-pdf-ai-usage__legend' })
    const addLegend = (cls: string, label: string) => {
      const item = legend.createDiv({ cls: 'foxycape-pdf-ai-usage__legend-item' })
      item.createDiv({ cls: `foxycape-pdf-ai-usage__swatch ${cls}` })
      item.createSpan({ text: label })
    }
    addLegend(
      'foxycape-pdf-ai-usage__seg--output',
      this.plugin.t('plugin_settings_ai_usage_output', 'Output'),
    )
    addLegend(
      'foxycape-pdf-ai-usage__seg--input',
      this.plugin.t('plugin_settings_ai_usage_input', 'Input'),
    )
    addLegend(
      'foxycape-pdf-ai-usage__seg--cache',
      this.plugin.t('plugin_settings_ai_usage_cache', 'Cache'),
    )
  }
}
