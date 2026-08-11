import { Modal, Setting, type App } from 'obsidian'

type Translate = (key: string, defaultText: string, named?: object) => string

type AppWithSetting = App & {
  setting?: {
    open: () => void
    openTabById: (id: string) => void
  }
}

export class LicenseRequiredModal extends Modal {
  private readonly t: Translate
  private readonly pluginId: string
  private readonly onClosed: () => void

  constructor(
    app: App,
    pluginId: string,
    t: Translate,
    onClosed: () => void,
  ) {
    super(app)
    this.pluginId = pluginId
    this.t = t
    this.onClosed = onClosed
  }

  onOpen() {
    const { contentEl } = this
    contentEl.empty()
    contentEl.addClass('foxycape-pdf-license-modal')

    contentEl.createEl('h2', {
      text: this.t('plugin_license_modal_title', 'Trial ended'),
    })
    contentEl.createEl('p', {
      text: this.t(
        'plugin_notice_license_required',
        'Your Foxycape PDF trial has ended. You can purchase a license in Foxycape PDF settings.',
      ),
    })

    // Bottom-right actions: primary CTA first (Open settings), then default Close.
    new Setting(contentEl)
      .addButton((button) => {
        button
          .setButtonText(
            this.t('plugin_license_modal_open_settings', 'Open settings'),
          )
          .setCta()
          .onClick(() => {
            this.close()
            this.openPluginSettings()
          })
      })
      .addButton((button) => {
        button
          .setButtonText(this.t('plugin_license_modal_close', 'Close'))
          .onClick(() => this.close())
      })
  }

  onClose() {
    this.contentEl.empty()
    this.onClosed()
  }

  private openPluginSettings = () => {
    const setting = (this.app as AppWithSetting).setting
    if (!setting) {
      return
    }
    setting.open()
    setting.openTabById(this.pluginId)
  }
}

export const showLicenseRequiredModal = (
  app: App,
  pluginId: string,
  t: Translate,
  onClosed: () => void,
) => {
  new LicenseRequiredModal(app, pluginId, t, onClosed).open()
}
