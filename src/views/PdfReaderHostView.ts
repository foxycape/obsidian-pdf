import { ItemView, Menu, TFile, type ViewStateResult, type WorkspaceLeaf } from 'obsidian'
import {
  ensurePdfjsPack,
  ensureReaderPack,
  pdfjsPackNeedsDownload,
  readerPackNeedsDownload,
} from '@/assets/ensureRuntimeAssets'
import type { FoxycapePdfPlugin } from '@/plugin/FoxycapePdfPlugin'
import { PDF_READER_VIEW_TYPE } from '@/settings/types'
import { loadPdfLib } from '@/views/loadPdfModule'
import { loadReaderBundle } from '@/views/loadReaderBundle'
import type { PdfReaderSession } from '@/views/PdfReaderSurface'

/**
 * Thin PDF leaf. pdf-lib.js and reader-bundle.js run before the session starts.
 */
export class PdfReaderHostView extends ItemView {
  navigation = true
  file: TFile | null = null
  sourceUrl: string | null = null
  readonly plugin: FoxycapePdfPlugin

  private session: PdfReaderSession | null = null
  private boot: Promise<void> | null = null
  private pendingState: { state: unknown; result: ViewStateResult } | null = null
  private overlayEl: HTMLElement | null = null
  private closed = false
  private pendingEphemeral: unknown
  private hasPendingEphemeral = false

  constructor(leaf: WorkspaceLeaf, plugin: FoxycapePdfPlugin) {
    super(leaf)
    this.plugin = plugin
  }

  getPdfSession() {
    return this.session
  }

  getReader() {
    return this.session?.getReader() ?? null
  }

  getViewType() {
    return PDF_READER_VIEW_TYPE
  }

  getDisplayText() {
    return (
      this.session?.getDisplayText() ??
      this.file?.basename ??
      this.plugin.t('plugin_view_display_name', 'Foxycape PDF')
    )
  }

  getIcon() {
    return this.session?.getIcon() ?? 'file-pdf'
  }

  canAcceptExtension(extension: string) {
    return extension.toLowerCase() === 'pdf'
  }

  onPaneMenu(menu: Menu, source: string): void {
    if (this.session) {
      this.session.onPaneMenu(menu, source)
      return
    }
    super.onPaneMenu(menu, source)
  }

  getState() {
    return (
      this.session?.getState() ?? {
        ...(this.file?.path ? { file: this.file.path } : {}),
        ...(this.sourceUrl ? { url: this.sourceUrl } : {}),
      }
    )
  }

  async setState(state: unknown, result: ViewStateResult): Promise<void> {
    this.pendingState = { state, result }
    await this.kick()
  }

  getEphemeralState(): Record<string, unknown> {
    return this.session?.getEphemeralState() ?? super.getEphemeralState()
  }

  setEphemeralState(state: unknown): void {
    if (this.session) {
      this.session.setEphemeralState(state)
      return
    }
    this.pendingEphemeral = state
    this.hasPendingEphemeral = true
    super.setEphemeralState(state)
  }

  requestOpenFind() {
    this.session?.requestOpenFind()
  }

  requestToggleScreenshot() {
    this.session?.requestToggleScreenshot()
  }

  async onOpen() {
    this.closed = false
    await this.kick()
  }

  async onClose() {
    this.closed = true
    this.boot = null
    this.pendingState = null
    this.hideOverlay()
    const session = this.session
    this.session = null
    if (session) {
      await session.onClose()
    }
  }

  private kick = (): Promise<void> => {
    if (this.boot === null) {
      this.boot = this.run().catch((error: unknown) => {
        this.boot = null
        if (!this.closed) {
          this.showInitError(error)
        }
      })
    }
    return this.boot
  }

  private run = async () => {
    try {
      const needPdf = await pdfjsPackNeedsDownload(this.plugin)
      const needReader = await readerPackNeedsDownload(this.plugin)
      if (this.closed) {
        return
      }
      if (needPdf || needReader) {
        this.showInitProgress(0, 0)
      }
      const loaded = { pdf: 0, reader: 0 }
      const totals = { pdf: 0, reader: 0 }
      const reportProgress = () => {
        this.showInitProgress(loaded.pdf + loaded.reader, totals.pdf + totals.reader)
      }
      await Promise.all([
        needPdf
          ? ensurePdfjsPack(this.plugin, {
              t: this.plugin.t,
              onProgress: (bytes, total) => {
                loaded.pdf = bytes
                totals.pdf = total
                reportProgress()
              },
            })
          : Promise.resolve(),
        needReader
          ? ensureReaderPack(this.plugin, {
              t: this.plugin.t,
              onProgress: (bytes, total) => {
                loaded.reader = bytes
                totals.reader = total
                reportProgress()
              },
            })
          : Promise.resolve(),
      ])
      if (this.closed) {
        return
      }
      await loadPdfLib(this.plugin)
      if (this.closed) {
        return
      }
      if (!this.session) {
        const readerBundle = await loadReaderBundle(this.plugin)
        this.session = readerBundle.attachPdfReader(this)
      }
      if (this.closed) {
        const session = this.session
        this.session = null
        await session?.onClose()
        return
      }
      if (this.session && this.hasPendingEphemeral) {
        const ephemeral = this.pendingEphemeral
        this.hasPendingEphemeral = false
        this.session.setEphemeralState(ephemeral)
      }
      this.hideOverlay()
      for (;;) {
        if (this.closed || !this.session) {
          return
        }
        const pending = this.pendingState
        if (pending) {
          this.pendingState = null
          await this.session.setState(pending.state, pending.result)
          continue
        }
        if (!this.session.isMounted()) {
          await this.session.onOpen()
          continue
        }
        return
      }
    } finally {
      this.boot = null
    }
  }

  private ensureOverlay = (): HTMLElement => {
    if (this.overlayEl?.isConnected) {
      return this.overlayEl
    }
    const overlay = this.contentEl.createDiv({ cls: 'foxycape-pdf-init-overlay' })
    overlay.createDiv({ cls: 'foxycape-pdf-init-status' })
    const progress = overlay.createDiv({ cls: 'foxycape-pdf-init-progress' })
    progress.createDiv({ cls: 'foxycape-pdf-init-progress-fill' })
    this.overlayEl = overlay
    return overlay
  }

  private showInitProgress = (loaded: number, total: number) => {
    if (this.closed) {
      return
    }
    const overlay = this.ensureOverlay()
    const status = overlay.querySelector('.foxycape-pdf-init-status')
    if (status) {
      status.textContent = this.plugin.t('plugin_pdf_init_status', 'Initializing…')
    }
    const fill = overlay.querySelector('.foxycape-pdf-init-progress-fill')
    if (!fill?.instanceOf(HTMLElement)) {
      return
    }
    const ratio = total > 0 ? Math.min(1, Math.max(0, loaded / total)) : 0
    fill.style.width = `${ratio * 100}%`
  }

  private showInitError = (error: unknown) => {
    const overlay = this.ensureOverlay()
    overlay.querySelector('.foxycape-pdf-init-progress')?.remove()
    const message = error instanceof Error ? error.message : String(error)
    const status = overlay.querySelector('.foxycape-pdf-init-status')
    if (status) {
      status.textContent = this.plugin.t(
        'plugin_pdf_init_failed',
        'Initialization failed: {message}',
        { message },
      )
    }
    if (overlay.querySelector('.foxycape-pdf-init-retry')) {
      return
    }
    const button = overlay.createEl('button', {
      cls: 'mod-cta foxycape-pdf-init-retry',
      text: this.plugin.t('plugin_pdf_init_retry', 'Retry'),
    })
    button.addEventListener('click', () => {
      this.hideOverlay()
      void this.kick()
    })
  }

  private hideOverlay = () => {
    this.overlayEl?.remove()
    this.overlayEl = null
  }
}
