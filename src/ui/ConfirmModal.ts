import { Modal, Setting, type App } from 'obsidian'

type ConfirmModalOptions = {
  title: string
  message: string
  confirmText: string
  cancelText: string
  /** Use warning style on the confirm button. */
  isWarning?: boolean
  onConfirm: () => void
}

export class ConfirmModal extends Modal {
  private readonly options: ConfirmModalOptions

  constructor(app: App, options: ConfirmModalOptions) {
    super(app)
    this.options = options
  }

  onOpen() {
    const { contentEl, options } = this
    contentEl.empty()
    contentEl.addClass('foxycape-pdf-confirm-modal')

    contentEl.createEl('h2', { text: options.title })
    contentEl.createEl('p', { text: options.message })

    new Setting(contentEl)
      .addButton((button) => {
        button.setButtonText(options.confirmText)
        if (options.isWarning) {
          button.setWarning()
        } else {
          button.setCta()
        }
        button.onClick(() => {
          this.close()
          options.onConfirm()
        })
      })
      .addButton((button) => {
        button.setButtonText(options.cancelText).onClick(() => this.close())
      })
  }

  onClose() {
    this.contentEl.empty()
  }
}

export const showConfirmModal = (app: App, options: ConfirmModalOptions) => {
  new ConfirmModal(app, options).open()
}

export type { ConfirmModalOptions }
