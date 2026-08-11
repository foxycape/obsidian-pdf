import { Modal, Setting, type App } from 'obsidian'

type Translate = (key: string, defaultText: string, named?: object) => string

export class PdfPasswordModal extends Modal {
  private password = ''
  private isSubmitted = false
  private readonly reason: string
  private readonly onSubmit: (password: string | null) => void
  private readonly t: Translate

  constructor(
    app: App,
    reason: string,
    onSubmit: (password: string | null) => void,
    t: Translate,
  ) {
    super(app)
    this.reason = reason
    this.onSubmit = onSubmit
    this.t = t
  }

  onOpen() {
    const { contentEl } = this
    contentEl.empty()
    contentEl.createEl('h2', {
      text: this.t('plugin_password_title', 'PDF password'),
    })
    contentEl.createEl('p', {
      text:
        this.reason ||
        this.t('plugin_password_protected', 'This PDF is password protected.'),
    })

    new Setting(contentEl)
      .setName(this.t('plugin_password_label', 'Password'))
      .addText((text) => {
        text.inputEl.type = 'password'
        text.inputEl.focus()
        text.onChange((value) => {
          this.password = value
        })
        text.inputEl.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            this.submit(this.password)
          }
        })
      })

    new Setting(contentEl)
      .addButton((button) => {
        button
          .setButtonText(this.t('plugin_password_cancel', 'Cancel'))
          .onClick(() => this.submit(null))
      })
      .addButton((button) => {
        button
          .setButtonText(this.t('plugin_password_unlock', 'Unlock'))
          .setCta()
          .onClick(() => this.submit(this.password))
      })
  }

  onClose() {
    this.contentEl.empty()
    if (!this.isSubmitted) {
      this.onSubmit(null)
    }
  }

  private submit(password: string | null) {
    if (this.isSubmitted) {
      return
    }
    this.isSubmitted = true
    this.onSubmit(password)
    this.close()
  }
}

export const promptPdfPassword = (app: App, reason: string, t: Translate) =>
  new Promise<string | null>((resolve) => {
    new PdfPasswordModal(app, reason, resolve, t).open()
  })
