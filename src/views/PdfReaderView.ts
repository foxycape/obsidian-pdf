import {
  ItemView,
  Menu,
  Notice,
  Scope,
  TFile,
  type EventRef,
  type ViewStateResult,
  type WorkspaceLeaf,
} from 'obsidian'
import { EventNames, formatFileSize, type IMarker, type Reader } from '@foxycape/core/kernal'
import type { FoxycapePdfPlugin } from '@/plugin/FoxycapePdfPlugin'
import { createPdfReader } from '@/reader/createPdfReader'
import { resolvePdfAssetUrls } from '@/reader/pdfAssets'
import { readVaultBinaryWithProgress } from '@/reader/readVaultBinaryWithProgress'
import { promptPdfPassword } from '@/ui/PdfPasswordModal'
import {
  mountPdfViewChrome,
  type PdfChromeMount,
} from '@/chrome/mountPdfViewChrome'
import { isViewHeaderVisible } from '@/chrome/isViewHeaderVisible'
import {
  mountPdfMarkToolbar,
  type PdfMarkToolbarMount,
} from '@/chrome/mark/mountPdfMarkToolbar'
import {
  mountPdfSearchBar,
  type PdfSearchBarMount,
} from '@/chrome/search/mountPdfSearchBar'
import {
  mountPdfScreenshot,
  type PdfScreenshotMount,
} from '@/chrome/screenshot/mountPdfScreenshot'
import {
  mountPdfMarkListPanel,
  type PdfMarkListPanelMount,
} from '@/sidebar/mountPdfMarkListPanel'
import { getPdfRenderer } from '@/chrome/usePdfRenderer'
import type { MarkDataChangePayload } from '@/marker/PdfMarker'
import { MarkNoteCompanion, syncMarkToSidecarNote } from '@/obsidian/markNoteSync'
import { applyPdfDeepLink } from '@/obsidian/pdfDeepLink'
import {
  displayNameFromRemotePdfUrl,
  fileNameFromRemotePdfUrl,
  normalizeRemoteDocumentUrl,
} from '@/obsidian/remotePdfLink'
import type { PdfImageLinkSource } from '@/obsidian/pdfImageRef'
import { PDF_READER_VIEW_TYPE } from '@/settings/types'
import { isObsidianMobile } from '@/ui/isObsidianMobile'
import type { IPdfRenderer } from '@foxycape/core/mediaTypes/pdf/renderer/IPdfRenderer'

export { PDF_READER_VIEW_TYPE }

export type PdfReaderViewState = {
  file?: string
  url?: string
}

const FILE_LOADING_DELAY_MS = 2000

export class PdfReaderView extends ItemView {
  file: TFile | null = null
  sourceUrl: string | null = null
  navigation = true

  private reader: Reader | null = null
  private getMarker: (() => IMarker | undefined) | null = null
  private bodyEl: HTMLElement | null = null
  private mountEl: HTMLElement | null = null
  private sidebarHost: HTMLElement | null = null
  private markPanelHost: HTMLElement | null = null
  private chromeMount: PdfChromeMount | null = null
  private markToolbarMount: PdfMarkToolbarMount | null = null
  private searchBarMount: PdfSearchBarMount | null = null
  private screenshotMount: PdfScreenshotMount | null = null
  private markListMount: PdfMarkListPanelMount | null = null
  private sidebarOpen = false
  private markPanelOpen = false
  private fileReadAbort: AbortController | null = null
  private readonly plugin: FoxycapePdfPlugin
  private readonly markNoteCompanion = new MarkNoteCompanion()
  private layoutChangeRef: EventRef | null = null
  private cssChangeRef: EventRef | null = null
  private headerResizeObserver: ResizeObserver | null = null
  private pendingSubpath: string | null = null

  constructor(leaf: WorkspaceLeaf, plugin: FoxycapePdfPlugin) {
    super(leaf)
    this.plugin = plugin
    // Obsidian's global Mod+F / Mod+C can eat DOM keydown before the PDF
    // container sees it. View.scope overrides those while this leaf is active.
    this.scope = new Scope(this.app.scope)
    this.scope.register(['Mod'], 'f', (evt) => {
      evt.preventDefault()
      this.requestOpenFind()
      return false
    })
    this.scope.register(['Mod'], 'c', (evt) => {
      evt.preventDefault()
      this.requestFormattedCopy(evt)
      return false
    })
  }

  /** Ctrl/Cmd+C formatted PDF text copy (paragraph-aware). */
  requestFormattedCopy(evt?: KeyboardEvent) {
    if (this.reader) {
      this.reader.events.emit(EventNames.CtrlWithCKeyCopy, evt)
    }
  }

  /** Toggle the in-document PDF search bar (Ctrl/Cmd+F). */
  requestOpenFind() {
    if (this.reader) {
      this.reader.events.emit(EventNames.RequestOpenFind)
      return
    }
    this.searchBarMount?.toggle()
  }

  requestToggleScreenshot() {
    this.screenshotMount?.toggle()
  }

  // Must be prototype methods: ItemView calls getViewType() inside super().
  getViewType() {
    return PDF_READER_VIEW_TYPE
  }

  getDisplayText() {
    if (this.file?.basename) {
      return this.file.basename
    }
    if (this.sourceUrl) {
      return displayNameFromRemotePdfUrl(this.sourceUrl)
    }
    return this.plugin.t('plugin_view_display_name', 'Foxycape PDF')
  }

  getIcon() {
    return 'file-pdf'
  }

  canAcceptExtension(extension: string) {
    return extension.toLowerCase() === 'pdf'
  }

  onPaneMenu(menu: Menu, source: string): void {
    menu.addItem((item) => {
      item
        .setTitle(this.plugin.t('pdf_search_find', 'Find'))
        .setIcon('search')
        .onClick(() => {
          this.requestOpenFind()
        })
    })
    menu.addItem((item) => {
      item
        .setTitle(this.plugin.t('pdf_mark_list', 'Highlight list'))
        .setIcon('highlighter')
        .setChecked(this.markPanelOpen)
        .onClick(() => {
          this.toggleMarkPanel()
        })
    })
    // Phone chrome hides the header settings gear; expose it via the more menu.
    if (document.body.classList.contains('is-phone')) {
      menu.addItem((item) => {
        item
          .setTitle(this.plugin.t('pdf_chrome_settings', 'Settings'))
          .setIcon('lucide-settings')
          .onClick(() => {
            this.chromeMount?.openSettings()
          })
      })
    }
    super.onPaneMenu(menu, source)
  }

  /**
   * Fallback-toolbar more menu: Find + Highlight list only
   * (no Obsidian Split right / Split down from onPaneMenu).
   */
  showPaneMenu(event: MouseEvent) {
    const menu = new Menu()
    // Obsidian Menu exposes `dom` at runtime; typings omit it.
    ;(menu as Menu & { dom: HTMLElement }).dom.addClass('foxycape-pdf-chrome-more-menu')
    menu.addItem((item) => {
      item
        .setTitle(this.plugin.t('pdf_search_find', 'Find'))
        .setIcon('search')
        .onClick(() => {
          this.requestOpenFind()
        })
    })
    menu.addItem((item) => {
      item
        .setTitle(this.plugin.t('pdf_mark_list', 'Highlight list'))
        .setIcon('highlighter')
        .setChecked(this.markPanelOpen)
        .onClick(() => {
          this.toggleMarkPanel()
        })
    })
    menu.showAtMouseEvent(event)
  }

  toggleMarkPanel(value?: boolean) {
    this.markPanelOpen = value ?? !this.markPanelOpen
    this.markListMount?.setOpen(this.markPanelOpen)
    this.containerEl.toggleClass(
      'foxycape-pdf-mark-panel-open',
      this.markPanelOpen,
    )
    this.syncMobilePanelOutsideClose()
  }

  private setSidebarOpen(open: boolean) {
    this.sidebarOpen = open
    this.chromeMount?.setSidebarOpen(this.sidebarOpen)
    this.containerEl.toggleClass('foxycape-pdf-sidebar-open', this.sidebarOpen)
    this.syncMobilePanelOutsideClose()
  }

  /** Close floating nav / mark panels when tapping outside them on mobile. */
  private readonly onMobilePanelOutsidePointerDown = (event: PointerEvent) => {
    if (!isObsidianMobile()) {
      return
    }
    if (!this.sidebarOpen && !this.markPanelOpen) {
      return
    }
    const target = event.target as Node | null
    if (!target) {
      return
    }
    if (this.sidebarOpen && this.sidebarHost?.contains(target)) {
      return
    }
    if (this.markPanelOpen && this.markPanelHost?.contains(target)) {
      return
    }
    // Ignore chrome toggles (header or content-area fallback toolbar).
    if (
      target.instanceOf(Element) &&
      target.closest?.(
        '.foxycape-pdf-nav-btn, .foxycape-pdf-header-nav, .foxycape-pdf-more-btn, .foxycape-pdf-fallback-toolbar, .view-header, .menu',
      )
    ) {
      return
    }
    if (this.sidebarOpen) {
      this.setSidebarOpen(false)
    }
    if (this.markPanelOpen) {
      this.toggleMarkPanel(false)
    }
  }

  private syncMobilePanelOutsideClose() {
    document.removeEventListener(
      'pointerdown',
      this.onMobilePanelOutsidePointerDown,
      true,
    )
    const shouldListen =
      isObsidianMobile() && (this.sidebarOpen || this.markPanelOpen)
    if (shouldListen) {
      document.addEventListener(
        'pointerdown',
        this.onMobilePanelOutsidePointerDown,
        true,
      )
    }
  }

  async onOpen() {
    this.contentEl.empty()
    this.contentEl.addClass('foxycape-pdf-view')
    this.bodyEl = this.contentEl.createDiv({ cls: 'foxycape-pdf-body' })
    this.sidebarHost = this.bodyEl.createDiv({
      cls: 'foxycape-pdf-sidebar-host',
    })
    this.mountEl = this.bodyEl.createDiv({ cls: 'foxycape-pdf-mount' })
    this.markPanelHost = this.bodyEl.createDiv({
      cls: 'foxycape-pdf-mark-panel-host',
    })
    this.bindWorkspaceEvents()
    this.bindChromePlacementObserver()
  }

  async onClose() {
    this.unbindChromePlacementObserver()
    this.unbindWorkspaceEvents()
    this.disposeSearchBar()
    this.disposeScreenshot()
    this.disposeMarkToolbar()
    this.disposeMarkListPanel()
    this.disposeChrome()
    await this.disposeReader()
    this.markNoteCompanion.reset()
    this.pendingSubpath = null
    this.file = null
    this.sourceUrl = null
    this.contentEl.empty()
    this.bodyEl = null
    this.mountEl = null
    this.sidebarHost = null
    this.markPanelHost = null
  }

  getState(): PdfReaderViewState {
    const state: PdfReaderViewState = {}
    if (this.file?.path) {
      state.file = this.file.path
    }
    if (this.sourceUrl) {
      state.url = this.sourceUrl
    }
    return state
  }

  async setState(state: unknown, result: ViewStateResult): Promise<void> {
    await super.setState(state, result)
    const record = state && typeof state === 'object' ? (state as PdfReaderViewState) : {}
    const filePath = typeof record.file === 'string' && record.file ? record.file : undefined
    const url = typeof record.url === 'string' ? normalizeRemoteDocumentUrl(record.url) : undefined

    const sameFile = !!filePath && this.file?.path === filePath && !url
    const sameUrl = !!url && this.sourceUrl === url && !filePath
    if (sameFile || sameUrl) {
      return
    }

    if (!this.mountEl || !this.sidebarHost || !this.markPanelHost) {
      await this.onOpen()
    }
    this.markNoteCompanion.reset()

    if (filePath) {
      const file = this.app.vault.getAbstractFileByPath(filePath)
      if (!(file instanceof TFile) || file.extension.toLowerCase() !== 'pdf') {
        this.file = null
        this.sourceUrl = null
        this.showError(
          this.plugin.t('plugin_error_open_failed', 'Failed to open PDF: {message}', {
            message: filePath,
          }),
        )
        return
      }
      this.file = file
      this.sourceUrl = null
      await this.openPdfSource({ file })
      return
    }

    if (url) {
      this.file = null
      this.sourceUrl = url
      await this.openPdfSource({ url })
      return
    }

    this.file = null
    this.sourceUrl = null
    await this.unloadCurrentPdf()
  }

  private async unloadCurrentPdf() {
    this.disposeSearchBar()
    this.disposeScreenshot()
    this.disposeMarkToolbar()
    this.disposeMarkListPanel()
    this.disposeChrome()
    await this.disposeReader()
    this.markNoteCompanion.reset()
    this.pendingSubpath = null
  }

  getEphemeralState(): Record<string, unknown> {
    return {
      ...super.getEphemeralState(),
      subpath: this.pendingSubpath ?? undefined,
    }
  }

  setEphemeralState(state: unknown): void {
    super.setEphemeralState(state)
    const subpath = this.extractSubpath(state)
    if (!subpath) {
      return
    }
    if (!this.reader?.loaded) {
      this.pendingSubpath = subpath
      return
    }
    void this.applySubpath(subpath)
  }

  private resolveLinkSource = (): PdfImageLinkSource | null => {
    if (this.file) {
      return { app: this.app, pdfFile: this.file }
    }
    if (this.sourceUrl) {
      return { app: this.app, sourceUrl: this.sourceUrl }
    }
    return null
  }

  private async openPdfSource(source: { file: TFile } | { url: string }) {
    if (!this.mountEl) {
      throw new Error('PDF mount element is not ready.')
    }

    this.disposeSearchBar()
    this.disposeScreenshot()
    this.disposeMarkToolbar()
    this.disposeMarkListPanel()
    this.disposeChrome()
    await this.disposeReader()

    this.fileReadAbort = new AbortController()
    const signal = this.fileReadAbort.signal

    try {
      await this.plugin.ensureRuntimeAssets()
      await this.plugin.syncLocaleIfNeeded()
      const assets = await resolvePdfAssetUrls(this.plugin)
      const { settings } = this.plugin
      const session = await createPdfReader({
        app: this.app,
        plugin: this.plugin,
        assets,
        locale: this.plugin.locale,
        storage: this.plugin.storage,
        viewPreferences: {
          enableViewPdfImages: settings.enableViewPdfImages,
          enablePdfThemeColorRemap: settings.enablePdfThemeColorRemap,
          pdfThemeColorRemapMode: settings.pdfThemeColorRemapMode,
          enableAutoCreateHighlightNotes: settings.enableAutoCreateHighlightNotes,
        },
        getLinkSource: this.resolveLinkSource,
        ensureEntitled: () => this.plugin.ensureLicenseEntitlement(),
        onRequirePassword: async (callback, reason) => {
          const password = await promptPdfPassword(
            this.app,
            reason,
            this.plugin.t,
          )
          if (password == null || password === '') {
            await callback(new Error('Password cancelled'))
            return
          }
          await callback(password)
        },
      })

      this.reader = session.reader
      this.getMarker = session.getMarker
      this.bindMarkNoteSync(session.reader)

      if ('file' in source) {
        const data = await this.readFileWithLoadingProgress(source.file, session.reader, signal)
        if (signal.aborted) {
          return
        }
        await session.reader.open(data, this.mountEl, this.contentEl, {
          extension: '.pdf',
          fileName: source.file.name,
          fileSize: source.file.stat.size,
          abortController: this.fileReadAbort,
        })
      } else {
        await session.reader.open(source.url, this.mountEl, this.contentEl, {
          extension: '.pdf',
          fileName: fileNameFromRemotePdfUrl(source.url),
          abortController: this.fileReadAbort,
        })
      }
      if (signal.aborted) {
        return
      }
      this.mountChrome(session.reader)
      this.mountMarkToolbar(session.reader, session.getMarker)
      this.mountSearchBar(session.reader)
      this.mountScreenshot(session.reader)
      this.mountMarkListPanel(session.reader, session.getMarker)

      if (this.pendingSubpath) {
        const subpath = this.pendingSubpath
        this.pendingSubpath = null
        void this.applySubpath(subpath)
      }
    } catch (error) {
      if (this.isAbortError(error) || signal.aborted) {
        return
      }
      console.error('[Foxycape PDF] failed to open file', error)
      const message = error instanceof Error ? error.message : String(error)
      this.disposeSearchBar()
      this.disposeScreenshot()
      this.disposeMarkToolbar()
      this.disposeMarkListPanel()
      this.disposeChrome()
      await this.disposeReader()
      this.showError(
        this.plugin.t('plugin_error_open_failed', 'Failed to open PDF: {message}', {
          message,
        }),
      )
      new Notice(
        this.plugin.t(
          'plugin_notice_open_failed_prefix',
          'Foxycape PDF: {message}',
          { message },
        ),
      )
    }
  }

  private async readFileWithLoadingProgress(
    file: TFile,
    reader: Reader,
    signal: AbortSignal,
  ): Promise<ArrayBuffer> {
    if (!this.mountEl) {
      throw new Error('PDF mount element is not ready.')
    }

    const loading = await reader.services.get('loading', true)
    // .foxycape-pdf-mount already sets position/overflow in pdf-view.css
    await loading?.initialize(this.mountEl, {
      // Obsidian CSS vars work before reader theme is applied.
      backgroundColor: 'var(--background-primary)',
      textColor: 'var(--text-muted)',
      iconColor: 'var(--text-accent)',
    })

    let showLoadingTimer: number | null = null
    let loadingLayerState: 'idle' | 'loading' | 'loaded' = 'idle'
    let latestReceived = 0
    let latestTotal = Math.max(0, file.stat?.size ?? 0)

    const clearLoadingTimer = () => {
      if (!showLoadingTimer) {
        return
      }
      window.clearTimeout(showLoadingTimer)
      showLoadingTimer = null
    }

    const buildProgressText = () => {
      const loaded = formatFileSize(latestReceived)
      const total = formatFileSize(latestTotal)
      return this.plugin.t(
        'plugin_loading_file_progress',
        `Loading file... ${loaded}/${total}`,
        { loaded, total },
      )
    }

    try {
      return await readVaultBinaryWithProgress(
        this.app,
        file,
        async ({ contentLength, receivedLength, done }) => {
          if (signal.aborted) {
            return
          }

          latestReceived = receivedLength
          latestTotal = contentLength > 0 ? contentLength : receivedLength

          if (done) {
            clearLoadingTimer()
            loadingLayerState = 'loaded'
            return
          }

          if (!showLoadingTimer) {
            showLoadingTimer = window.setTimeout(() => {
              void (async () => {
                if (loadingLayerState === 'loaded' || signal.aborted) {
                  return
                }
                loadingLayerState = 'loading'
                await loading?.show(buildProgressText())
              })()
            }, FILE_LOADING_DELAY_MS)
            return
          }

          if (loadingLayerState === 'loading') {
            await loading?.show(buildProgressText())
          }
        },
        signal,
      )
    } finally {
      clearLoadingTimer()
    }
  }

  private isAbortError(error: unknown) {
    return (
      (error instanceof DOMException && error.name === 'AbortError') ||
      (error instanceof Error && error.name === 'AbortError')
    )
  }

  private mountChrome(reader: Reader) {
    if (!this.sidebarHost) {
      return
    }
    this.disposeChromeMount()
    this.chromeMount = mountPdfViewChrome({
      containerEl: this.containerEl,
      contentEl: this.contentEl,
      sidebarHost: this.sidebarHost,
      reader,
      t: this.plugin.t,
      sidebarOpen: this.sidebarOpen,
      getViewPreferences: () => ({
        enableViewPdfImages: this.plugin.settings.enableViewPdfImages,
        enablePdfThemeColorRemap: this.plugin.settings.enablePdfThemeColorRemap,
        pdfThemeColorRemapMode: this.plugin.settings.pdfThemeColorRemapMode,
        enableAutoCreateHighlightNotes:
          this.plugin.settings.enableAutoCreateHighlightNotes,
      }),
      onUpdateViewPreferences: async (patch) => {
        await this.plugin.updatePdfViewPreferences(patch)
      },
      onToggleSidebar: () => {
        this.setSidebarOpen(!this.sidebarOpen)
      },
      onRequestCloseSidebar: () => {
        if (isObsidianMobile()) {
          this.setSidebarOpen(false)
        }
      },
      onOpenMoreMenu: (event) => {
        this.showPaneMenu(event)
      },
      screenshotActive: this.screenshotMount?.isActive() ?? false,
      onToggleScreenshot: () => {
        this.screenshotMount?.toggle()
      },
    })
    this.containerEl.toggleClass('foxycape-pdf-sidebar-open', this.sidebarOpen)
    this.syncMobilePanelOutsideClose()
  }

  /** Remount chrome when tab title bar visibility changes; keep sidebar state. */
  private syncChromePlacement() {
    if (!this.reader || !this.sidebarHost || !this.chromeMount) {
      return
    }
    const next = isViewHeaderVisible(this.containerEl) ? 'header' : 'fallback'
    if (this.chromeMount.placement === next) {
      return
    }
    this.mountChrome(this.reader)
    this.chromeMount?.setScreenshotActive(this.screenshotMount?.isActive() ?? false)
  }

  private mountMarkToolbar(reader: Reader, getMarker: () => IMarker | undefined) {
    if (!this.mountEl) {
      return
    }
    this.disposeMarkToolbar()
    this.markToolbarMount = mountPdfMarkToolbar({
      hostEl: this.mountEl,
      reader,
      getMarker,
      t: this.plugin.t,
      getLinkSource: this.resolveLinkSource,
      ensureEntitled: () => this.plugin.ensureLicenseEntitlement(),
    })
  }

  private mountSearchBar(reader: Reader) {
    if (!this.mountEl) {
      return
    }
    this.disposeSearchBar()
    try {
      this.searchBarMount = mountPdfSearchBar({
        hostEl: this.mountEl,
        reader,
        t: this.plugin.t,
      })
    } catch (error) {
      console.warn('[Foxycape PDF] failed to mount search bar', error)
      this.searchBarMount = null
    }
  }

  private mountScreenshot(reader: Reader) {
    if (!this.mountEl) {
      return
    }
    this.disposeScreenshot()
    try {
      this.screenshotMount = mountPdfScreenshot({
        viewEl: this.containerEl,
        hostEl: this.mountEl,
        reader,
        t: this.plugin.t,
        getLinkSource: this.resolveLinkSource,
        ensureEntitled: () => this.plugin.ensureLicenseEntitlement(),
        onActiveChange: (active) => {
          this.syncScreenshotMode(active)
        },
      })
    } catch (error) {
      console.warn('[Foxycape PDF] failed to mount screenshot overlay', error)
      this.screenshotMount = null
    }
  }

  private syncScreenshotMode(active: boolean) {
    this.containerEl.toggleClass('foxycape-pdf--screenshot-mode', active)
    this.markToolbarMount?.setPaused(active)
    getPdfRenderer(this.reader)?.setImageToolsPaused(active)
    this.chromeMount?.setScreenshotActive(active)
  }

  private mountMarkListPanel(
    reader: Reader,
    getMarker: () => IMarker | undefined,
  ) {
    if (!this.markPanelHost) {
      return
    }
    this.disposeMarkListPanel()
    try {
      this.markListMount = mountPdfMarkListPanel({
        hostEl: this.markPanelHost,
        reader,
        getMarker,
        open: this.markPanelOpen,
        t: this.plugin.t,
        onClose: () => {
          this.toggleMarkPanel(false)
        },
      })
      this.containerEl.toggleClass(
        'foxycape-pdf-mark-panel-open',
        this.markPanelOpen,
      )
      this.syncMobilePanelOutsideClose()
    } catch (error) {
      console.warn('[Foxycape PDF] failed to mount mark list panel', error)
      this.markListMount = null
    }
  }

  private disposeMarkToolbar() {
    this.markToolbarMount?.dispose()
    this.markToolbarMount = null
  }

  private disposeSearchBar() {
    this.searchBarMount?.dispose()
    this.searchBarMount = null
  }

  private disposeScreenshot() {
    this.screenshotMount?.dispose()
    this.screenshotMount = null
    this.syncScreenshotMode(false)
  }

  private disposeMarkListPanel() {
    this.markListMount?.dispose()
    this.markListMount = null
    this.markPanelOpen = false
    this.containerEl.removeClass('foxycape-pdf-mark-panel-open')
    this.syncMobilePanelOutsideClose()
  }

  private disposeChromeMount() {
    this.chromeMount?.dispose()
    this.chromeMount = null
  }

  private disposeChrome() {
    this.disposeChromeMount()
    this.sidebarOpen = false
    this.containerEl.removeClass('foxycape-pdf-sidebar-open')
    this.containerEl.removeClass('foxycape-pdf-chrome-fallback')
    this.syncMobilePanelOutsideClose()
  }

  private async disposeReader() {
    this.fileReadAbort?.abort()
    this.fileReadAbort = null

    if (!this.reader) {
      this.getMarker = null
      return
    }
    try {
      this.reader.events.off(EventNames.DataChange, this.onMarkDataChange)
      await this.reader.dispose()
    } catch (error) {
      console.warn('[Foxycape PDF] reader dispose failed', error)
    }
    this.reader = null
    this.getMarker = null
    this.mountEl?.empty()
  }

  private bindWorkspaceEvents() {
    if (this.layoutChangeRef) {
      return
    }
    this.layoutChangeRef = this.app.workspace.on('layout-change', () => {
      this.markNoteCompanion.onLayoutChange(this.app)
      this.syncChromePlacement()
    })
  }

  private unbindWorkspaceEvents() {
    if (!this.layoutChangeRef) {
      return
    }
    this.app.workspace.offref(this.layoutChangeRef)
    this.layoutChangeRef = null
  }

  private bindChromePlacementObserver() {
    this.unbindChromePlacementObserver()
    const header = this.containerEl.querySelector('.view-header')
    if (header && typeof ResizeObserver !== 'undefined') {
      this.headerResizeObserver = new ResizeObserver(() => {
        this.syncChromePlacement()
      })
      this.headerResizeObserver.observe(header)
    }
    this.cssChangeRef = this.app.workspace.on('css-change', () => {
      this.syncChromePlacement()
    })
  }

  private unbindChromePlacementObserver() {
    this.headerResizeObserver?.disconnect()
    this.headerResizeObserver = null
    if (this.cssChangeRef) {
      this.app.workspace.offref(this.cssChangeRef)
      this.cssChangeRef = null
    }
  }

  private bindMarkNoteSync(reader: Reader) {
    reader.events.off(EventNames.DataChange, this.onMarkDataChange)
    reader.events.on(EventNames.DataChange, this.onMarkDataChange)
  }

  private onMarkDataChange = (payload: MarkDataChangePayload) => {
    if (payload?.dataType !== 'mark' || payload.action !== 'create') {
      return
    }
    if (!this.plugin.settings.enableAutoCreateHighlightNotes) {
      return
    }
    const mark = payload.items[0]
    if (!mark || (!this.file && !this.sourceUrl)) {
      return
    }
    void syncMarkToSidecarNote(
      {
        app: this.app,
        pdfFile: this.file ?? undefined,
        sourceUrl: this.sourceUrl ?? undefined,
        mark,
        selection: payload.selection,
        t: this.plugin.t,
      },
      this.markNoteCompanion,
    )
  }

  private extractSubpath(state: unknown): string | null {
    if (!state || typeof state !== 'object') {
      return null
    }
    const record = state as Record<string, unknown>
    const direct = record.subpath
    if (typeof direct === 'string' && direct) {
      return direct.startsWith('#') ? direct : `#${direct}`
    }
    const focus = record.focus
    if (focus && typeof focus === 'object') {
      const focusSubpath = (focus as Record<string, unknown>).subpath
      if (typeof focusSubpath === 'string' && focusSubpath) {
        return focusSubpath.startsWith('#') ? focusSubpath : `#${focusSubpath}`
      }
    }
    return null
  }

  private async applySubpath(subpath: string) {
    const renderer = getPdfRenderer(this.reader) as unknown as IPdfRenderer | null
    try {
      await applyPdfDeepLink({
        subpath,
        renderer,
        getMarker: () => this.getMarker?.(),
      })
    } catch (error) {
      console.warn('[Foxycape PDF] failed to apply deep link', error)
    }
  }

  private showError(message: string) {
    if (!this.mountEl) {
      return
    }
    this.mountEl.empty()
    const errorEl = this.mountEl.createDiv({ cls: 'foxycape-pdf-error' })
    errorEl.setText(message)
  }
}
