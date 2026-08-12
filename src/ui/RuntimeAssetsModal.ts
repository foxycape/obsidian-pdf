import { Modal, Setting, type App } from 'obsidian'

type Translate = (key: string, defaultText: string, named?: object) => string

export type RuntimeAssetsProgressUi = {
  setDownloading: () => void
  setInstalling: (current: number, total: number) => void
}

type RuntimeAssetsModalOptions = {
  app: App
  t: Translate
  sizeHint: string
  run: (ui: RuntimeAssetsProgressUi) => Promise<void>
}

/**
 * Modal for first-time runtime asset download: explanation + progress + retry.
 */
export class RuntimeAssetsModal extends Modal {
  private readonly t: Translate
  private readonly sizeHint: string
  private readonly run: RuntimeAssetsModalOptions['run']

  private statusEl: HTMLElement | null = null
  private errorEl: HTMLElement | null = null
  private progressEl: HTMLElement | null = null
  private progressFillEl: HTMLElement | null = null
  private actionsEl: HTMLElement | null = null

  private phase: 'working' | 'done' | 'error' = 'working'
  private settled = false
  private resolveWait: (() => void) | null = null
  private rejectWait: ((error: Error) => void) | null = null
  private closeTimer = 0

  constructor(options: RuntimeAssetsModalOptions) {
    super(options.app)
    this.t = options.t
    this.sizeHint = options.sizeHint
    this.run = options.run
  }

  /** Open the modal and resolve when install succeeds (reject on close/failure). */
  openAndWait = (): Promise<void> =>
    new Promise((resolve, reject) => {
      this.resolveWait = resolve
      this.rejectWait = reject
      this.open()
    })

  onOpen() {
    const { contentEl } = this
    contentEl.empty()
    contentEl.addClass('foxycape-pdf-assets-modal')

    contentEl.createEl('h2', {
      text: this.t('plugin_assets_modal_title', 'Download reader assets'),
    })
    contentEl.createEl('p', {
      cls: 'foxycape-pdf-assets-modal-desc',
      text: this.t(
        'plugin_assets_modal_description',
        'First open needs a one-time download ({size}) from GitHub: PDF worker, fonts, and character maps. Files are cached in the plugin folder.',
        { size: this.sizeHint },
      ),
    })

    this.progressEl = contentEl.createDiv({ cls: 'foxycape-pdf-assets-progress is-indeterminate' })
    this.progressFillEl = this.progressEl.createDiv({ cls: 'foxycape-pdf-assets-progress-fill' })

    this.statusEl = contentEl.createEl('p', {
      cls: 'foxycape-pdf-assets-modal-status',
      text: this.t('plugin_assets_modal_status_downloading', 'Downloading…'),
    })
    this.errorEl = contentEl.createEl('p', {
      cls: 'foxycape-pdf-assets-modal-error',
    })
    this.errorEl.hide()

    this.actionsEl = contentEl.createDiv({ cls: 'foxycape-pdf-assets-modal-actions' })
    this.renderActions()

    void this.startJob()
  }

  onClose() {
    if (this.closeTimer) {
      window.clearTimeout(this.closeTimer)
      this.closeTimer = 0
    }
    this.contentEl.empty()
    if (!this.settled) {
      this.settleReject(new Error('Runtime asset download was cancelled.'))
    }
  }

  close() {
    // Block dismiss while download/install is in progress.
    if (this.phase === 'working') {
      return
    }
    super.close()
  }

  private startJob = async () => {
    this.phase = 'working'
    this.renderActions()
    this.setDownloading()
    this.clearError()

    try {
      await this.run({
        setDownloading: this.setDownloading,
        setInstalling: this.setInstalling,
      })
      this.phase = 'done'
      this.setDone()
      this.renderActions()
      this.settleResolve()
      this.closeTimer = window.setTimeout(() => {
        this.closeTimer = 0
        this.close()
      }, 700)
    } catch (error) {
      this.phase = 'error'
      const message =
        error instanceof Error
          ? error.message
          : this.t(
              'plugin_notice_assets_still_missing',
              'Runtime assets are still missing after download.',
            )
      this.showError(message)
      this.renderActions()
    }
  }

  private setDownloading = () => {
    this.progressEl?.addClass('is-indeterminate')
    this.progressEl?.removeClass('is-determinate')
    this.progressFillEl?.setCssStyles({ width: '' })
    if (this.statusEl) {
      this.statusEl.setText(
        this.t('plugin_assets_modal_status_downloading', 'Downloading…'),
      )
    }
  }

  private setInstalling = (current: number, total: number) => {
    this.progressEl?.removeClass('is-indeterminate')
    this.progressEl?.addClass('is-determinate')
    const ratio = total > 0 ? Math.min(1, current / total) : 0
    this.progressFillEl?.setCssStyles({
      width: `${Math.round(ratio * 100)}%`,
    })
    if (this.statusEl) {
      this.statusEl.setText(
        this.t(
          'plugin_assets_modal_status_installing',
          'Installing… {current}/{total}',
          { current: String(current), total: String(total) },
        ),
      )
    }
  }

  private setDone = () => {
    this.progressEl?.removeClass('is-indeterminate')
    this.progressEl?.addClass('is-determinate')
    this.progressFillEl?.setCssStyles({ width: '100%' })
    if (this.statusEl) {
      this.statusEl.setText(
        this.t('plugin_assets_modal_status_done', 'Assets installed'),
      )
    }
  }

  private showError = (message: string) => {
    this.progressEl?.removeClass('is-indeterminate')
    if (this.errorEl) {
      this.errorEl.setText(message)
      this.errorEl.show()
    }
    if (this.statusEl) {
      this.statusEl.setText(
        this.t('plugin_assets_modal_status_failed', 'Download failed'),
      )
    }
  }

  private clearError = () => {
    if (this.errorEl) {
      this.errorEl.empty()
      this.errorEl.hide()
    }
  }

  private renderActions = () => {
    if (!this.actionsEl) {
      return
    }
    this.actionsEl.empty()

    if (this.phase === 'working') {
      this.actionsEl.createEl('p', {
        cls: 'foxycape-pdf-assets-modal-hint',
        text: this.t(
          'plugin_assets_modal_working_hint',
          'Please wait — this dialog will close when finished.',
        ),
      })
      return
    }

    if (this.phase === 'error') {
      new Setting(this.actionsEl)
        .addButton((button) => {
          button
            .setButtonText(this.t('plugin_assets_modal_retry', 'Retry'))
            .setCta()
            .onClick(() => {
              void this.startJob()
            })
        })
        .addButton((button) => {
          button
            .setButtonText(this.t('plugin_assets_modal_close', 'Close'))
            .onClick(() => {
              this.settleReject(
                new Error(
                  this.t(
                    'plugin_notice_assets_still_missing',
                    'Runtime assets are still missing after download.',
                  ),
                ),
              )
              this.close()
            })
        })
    }
  }

  private settleResolve = () => {
    if (this.settled) {
      return
    }
    this.settled = true
    this.resolveWait?.()
    this.resolveWait = null
    this.rejectWait = null
  }

  private settleReject = (error: Error) => {
    if (this.settled) {
      return
    }
    this.settled = true
    this.rejectWait?.(error)
    this.resolveWait = null
    this.rejectWait = null
  }
}

export const showRuntimeAssetsModal = (options: RuntimeAssetsModalOptions) =>
  new RuntimeAssetsModal(options).openAndWait()
