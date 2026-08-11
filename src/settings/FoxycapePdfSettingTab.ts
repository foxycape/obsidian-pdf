import { PluginSettingTab, Setting, type App, type ButtonComponent, type TextComponent } from 'obsidian'
import { debounce } from '@core/kernal/Debounce'
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

  private readonly debouncedValidateLicense = debounce((value: string) => {
    void this.applyLicenseInput(value)
  }, LICENSE_INPUT_DEBOUNCE_MS)

  constructor(
    app: App,
    private readonly plugin: FoxycapePdfPlugin,
  ) {
    super(app, plugin)
  }

  display = () => {
    void this.plugin.syncLocaleIfNeeded().then(() => {
      const { containerEl } = this
      containerEl.empty()
      this.licenseStatusEl = null
      this.licenseInput = null
      this.licenseActionButton = null

      new Setting(containerEl)
        .setName(this.plugin.t('plugin_settings_title', 'Foxycape PDF'))
        .setHeading()

      new Setting(containerEl)
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
        .addToggle((toggle) => {
          toggle.setValue(this.plugin.settings.useAsDefaultPdfViewer).onChange((value) => {
            void this.plugin.setUseAsDefaultPdfViewer(value)
          })
        })

      this.renderLicenseSection(containerEl)
    })
  }

  private renderLicenseSection = (containerEl: HTMLElement) => {
    new Setting(containerEl)
      .setName(this.plugin.t('plugin_settings_license_heading', 'License'))
      .setHeading()

    const licenseSetting = new Setting(containerEl)
      .setName(
        this.plugin.t('plugin_settings_license_name', 'License key'),
      )
      .setDesc('')
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

    this.licenseStatusEl = licenseSetting.descEl
    this.refreshLicenseInputReadonly()
    this.refreshLicenseActionButton()
    this.refreshLicenseStatus()
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
    if (!button) {
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

    const { settings, licenseService } = this.plugin

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

    const days = licenseService.getTrialDaysRemaining()
    el.createDiv({
      text: this.plugin.t(
        'plugin_settings_trial_remaining',
        'Trial days remaining: {days}',
        { days },
      ),
    })
  }
}
