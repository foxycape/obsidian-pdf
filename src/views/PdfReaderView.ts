import {
  ItemView,
  Menu,
  Notice,
  Scope,
  TFile,
  type EventRef,
  type ViewStateResult,
} from 'obsidian'
import { EventNames, FileLocation, formatFileSize, OpenOptions, type Reader } from '@foxycape/core/kernal'
import type { IMarker } from '@/mark'
import type { FoxycapePdfPlugin } from '@/plugin/FoxycapePdfPlugin'
import { createPdfReader } from '@/reader/createPdfReader'
import {
  ensurePdfRuntime,
  getLegacyMarkCatalog,
  getPdfStorage,
  getPdfWorker,
} from '@/reader/pdfRuntime'
import { resolvePdfAssetUrls } from '@/reader/pdfAssets'
import { readVaultBinaryWithProgress } from '@/reader/readVaultBinaryWithProgress'
import { promptPdfPassword } from '@/ui/PdfPasswordModal'
import { ASTROID_ICON_ID } from '@/ui/astroidIcon'
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
import type { MarkDataChangePayload, PdfMarker } from '@/marker/PdfMarker'
import { migrateOpenedDocument } from '@/storage/legacy/migrateLegacyMarks'
import { openRemoteHeadReader } from '@/storage/legacy/openRemoteHeadReader'
import { openVaultFileRange } from '@/storage/legacy/openVaultFileRange'
import type { ByteRangeReader } from '@/storage/legacy/ByteRangeReader'
import { MarkNoteCompanion, syncMarkToSidecarNote } from '@/obsidian/markNoteSync'
import { appendAiNote } from '@/ai/notes/appendAiNote'
import { findPassageContentRange } from '@/ai/passage/stores'
import { tryGetAiRuntime, type PassageNoteWrite } from '@/ai/runtime'
import { mountAiChatPanel, type AiChatDraft, type AiChatPanelMount } from '@/ai/ui/mountAiChatPanel'
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
import type { PdfReaderSurface } from '@/views/PdfReaderSurface'

export { PDF_READER_VIEW_TYPE }

export type PdfReaderViewState = {
  file?: string
  url?: string
}

const FILE_LOADING_DELAY_MS = 2000

export class PdfReaderView {
  private readonly surface: PdfReaderSurface

  private reader: Reader | null = null
  private getMarker: (() => IMarker | undefined) | null = null
  private bodyEl: HTMLElement | null = null
  private mountEl: HTMLElement | null = null
  private sidebarHost: HTMLElement | null = null
  private markPanelHost: HTMLElement | null = null
  private chromeMount: PdfChromeMount | null = null
  private markToolbarMount: PdfMarkToolbarMount | null = null
  private aiChatMount: AiChatPanelMount | null = null
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
  private noteWriter: ((input: PassageNoteWrite) => Promise<void>) | null = null

  constructor(surface: PdfReaderSurface) {
    this.surface = surface
    this.plugin = surface.plugin
    // Obsidian's global Mod+F / Mod+C can eat DOM keydown before the PDF
    // container sees it. View.scope overrides those while this leaf is active.
    surface.navigation = true
    surface.scope = new Scope(surface.app.scope)
    surface.scope.register(['Mod'], 'f', (evt) => {
      evt.preventDefault()
      this.requestOpenFind()
      return false
    })
    surface.scope.register(['Mod'], 'c', (evt) => {
      evt.preventDefault()
      this.requestFormattedCopy(evt)
      return false
    })
  }

  private get app() {
    return this.surface.app
  }

  private get contentEl() {
    return this.surface.contentEl
  }

  private get containerEl() {
    return this.surface.containerEl
  }

  get file() {
    return this.surface.file
  }

  set file(value: TFile | null) {
    this.surface.file = value
  }

  get sourceUrl() {
    return this.surface.sourceUrl
  }

  set sourceUrl(value: string | null) {
    this.surface.sourceUrl = value
  }

  isMounted() {
    return this.mountEl != null
  }

  /** Ctrl/Cmd+C formatted PDF text copy (paragraph-aware). */
  requestFormattedCopy(evt?: KeyboardEvent) {
    if (this.reader) {
      this.reader.events.emit(EventNames.CtrlWithCKeyCopy, evt)
    }
  }

  getReader() {
    return this.reader
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
    this.addReadingMenuItems(menu)
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
    ItemView.prototype.onPaneMenu.call(this.surface, menu, source)
  }

  /**
   * Fallback-toolbar more menu: Find, Marks, and Ask AI
   * (no Obsidian Split right / Split down from onPaneMenu).
   */
  showPaneMenu(event: MouseEvent) {
    const menu = new Menu()
    ;(menu as Menu & { dom: HTMLElement }).dom.addClass('foxycape-pdf-chrome-more-menu')
    this.addReadingMenuItems(menu)
    menu.showAtMouseEvent(event)
  }

  private addReadingMenuItems(menu: Menu) {
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
        .setTitle(this.plugin.t('pdf_marks', 'Marks'))
        .setIcon('highlighter')
        .setChecked(this.markPanelOpen)
        .onClick(() => {
          this.toggleMarksFromMenu()
        })
    })
    menu.addItem((item) => {
      item
        .setTitle(this.plugin.t('ai_chat_title', 'Ask AI'))
        .setIcon(ASTROID_ICON_ID)
        .setChecked(this.aiChatMount?.isOpen() ?? false)
        .onClick(() => {
          this.toggleAskAi()
        })
    })
  }

  private toggleMarksFromMenu() {
    if (this.markPanelOpen) {
      this.toggleMarkPanel(false)
      return
    }
    this.markListMount?.openTab('highlights')
    this.toggleMarkPanel(true)
  }

  private currentPdfSource(): Pick<AiChatDraft, 'pdfTitle' | 'filePath' | 'sourceUrl'> {
    return {
      pdfTitle:
        this.file?.basename ||
        (this.sourceUrl ? displayNameFromRemotePdfUrl(this.sourceUrl) : ''),
      filePath: this.file?.path,
      sourceUrl: this.sourceUrl || undefined,
    }
  }

  private toggleAskAi() {
    const chat = this.ensureAiChat()
    if (chat.isOpen()) {
      chat.close()
      return
    }
    const reader = this.reader
    const getMarker = this.getMarker
    const simpleId = reader?.context?.id ?? ''
    if (!reader || !getMarker || !simpleId) {
      return
    }
    chat.open(reader, getMarker, {
      simpleId,
      quote: '',
      ...this.currentPdfSource(),
    })
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
    if (this.mountEl) {
      return
    }
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
    this.unbindAiNoteWriter()
    this.unbindChromePlacementObserver()
    this.unbindWorkspaceEvents()
    this.disposeSearchBar()
    this.disposeScreenshot()
    this.disposeMarkToolbar()
    this.disposeMarkListPanel()
    this.aiChatMount?.dispose()
    this.aiChatMount = null
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
    await ItemView.prototype.setState.call(this.surface, state, result)
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
      ...ItemView.prototype.getEphemeralState.call(this.surface),
      subpath: this.pendingSubpath ?? undefined,
    }
  }

  setEphemeralState(state: unknown): void {
    ItemView.prototype.setEphemeralState.call(this.surface, state)
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
      await ensurePdfRuntime()
      const assets = await resolvePdfAssetUrls(this.plugin)
      const { settings } = this.plugin
      const session = await createPdfReader({
        app: this.app,
        plugin: this.plugin,
        assets,
        device: this.plugin.device,
        locale: this.plugin.locale,
        storage: getPdfStorage(),
        computeMd5: (bytes) => getPdfWorker().computeMd5(bytes),
        viewPreferences: {
          enableViewPdfImages: settings.enableViewPdfImages,
          enablePdfThemeColorRemap: settings.enablePdfThemeColorRemap,
          pdfThemeColorRemapMode: settings.pdfThemeColorRemapMode,
          enableAutoCreateHighlightNotes: settings.enableAutoCreateHighlightNotes,
          writeExplainToMarkdown: settings.writeExplainToMarkdown,
          writeLookupToMarkdown: settings.writeLookupToMarkdown,
          writeTranslateToMarkdown: settings.writeTranslateToMarkdown,
        },
        getLinkSource: this.resolveLinkSource,
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
      this.bindAiNoteWriter(session.reader)

      if ('file' in source) {
        const data = await this.readFileWithLoadingProgress(source.file, session.reader, signal)
        if (signal.aborted) {
          return
        }
        const openOptions = Object.assign(new OpenOptions(), {
          extension: '.pdf',
          fileName: source.file.name,
          fileSize: source.file.stat.size,
          abortController: this.fileReadAbort,
          ...(this.pendingSubpath
            ? { location: new FileLocation('0', 1, 'ratio') }
            : {}),
        })
        await session.reader.open(data, this.mountEl, this.contentEl, openOptions)
      } else {
        const openOptions = Object.assign(new OpenOptions(), {
          extension: '.pdf',
          fileName: fileNameFromRemotePdfUrl(source.url),
          abortController: this.fileReadAbort,
          ...(this.pendingSubpath
            ? { location: new FileLocation('0', 1, 'ratio') }
            : {}),
        })
        await session.reader.open(source.url, this.mountEl, this.contentEl, openOptions)
      }
      if (signal.aborted) {
        return
      }
      void this.migrateLegacyMarks(source, session.reader)
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

  private async migrateLegacyMarks(
    source: { file: TFile } | { url: string },
    reader: Reader,
  ) {
    const simpleId = reader.context?.id
    const catalog = getLegacyMarkCatalog()
    if (!simpleId || !catalog.hasPending) {
      return
    }
    let prefix: ByteRangeReader | undefined
    let localFile: ByteRangeReader | undefined
    try {
      if ('file' in source) {
        localFile = await openVaultFileRange(this.app, source.file)
        prefix = localFile
      } else if (catalog.md5.size > 0) {
        const httpClient = await reader.services.get('httpClient')
        if (httpClient) {
          prefix = await openRemoteHeadReader(httpClient, source.url)
        }
      }
      const changed = await migrateOpenedDocument({
        kv: getPdfStorage(),
        marks: getPdfStorage().marks,
        readingProgress: getPdfStorage().readingProgress,
        catalog,
        simpleId,
        prefix,
        localFile,
        hasher: getPdfWorker(),
      })
      if (!changed || reader.disposed) {
        return
      }
      const marker = this.getMarker() as PdfMarker | undefined
      await marker?.reloadFromStorage()
    } catch (error) {
      console.error('[Foxycape PDF] failed to migrate legacy marks', error)
    } finally {
      await prefix?.close()
      if (localFile && localFile !== prefix) {
        await localFile.close()
      }
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
        writeExplainToMarkdown: this.plugin.settings.writeExplainToMarkdown,
        writeLookupToMarkdown: this.plugin.settings.writeLookupToMarkdown,
        writeTranslateToMarkdown: this.plugin.settings.writeTranslateToMarkdown,
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
      storage: getPdfStorage(),
      passageStorage: getPdfStorage(),
      httpClient: this.plugin.apiClient.httpClient,
      getLinkSource: this.resolveLinkSource,
      onOpenAi: (draft) => {
        this.ensureAiChat().open(reader, getMarker, {
          simpleId: draft.simpleId,
          quote: draft.quote,
          prompt: draft.prompt,
          autoSend: draft.autoSend,
          displayInput: draft.displayInput,
          ...this.currentPdfSource(),
        })
      },
      onNeedAccess: (mode) => {
        this.ensureAiChat().openAccess(mode)
      },
      onOpenModel: () => {
        this.ensureAiChat().openModel()
      },
      onOpenLanguage: () => {
        this.ensureAiChat().openLanguage()
      },
      onOpenTranslateList: () => {
        this.markListMount?.openTab('translates')
        this.toggleMarkPanel(true)
      },
      getVisibility: () => ({
        displayMarkPenInToolbar: this.plugin.settings.displayMarkPenInToolbar,
        displayWavyInToolbar: this.plugin.settings.displayWavyInToolbar,
        displayUnderlineInToolbar: this.plugin.settings.displayUnderlineInToolbar,
        displayTranslateInToolbar: this.plugin.settings.displayTranslateInToolbar,
        displayExplainPassageInToolbar: this.plugin.settings.displayExplainPassageInToolbar,
        displayLookupWordInToolbar: this.plugin.settings.displayLookupWordInToolbar,
        displayAiInToolbar: this.plugin.settings.displayAiInToolbar,
      }),
      setVisibility: (next) => {
        this.plugin.settings = { ...this.plugin.settings, ...next }
        void this.plugin.saveSettings()
      },
    })
  }

  private ensureAiChat(): AiChatPanelMount {
    if (!this.aiChatMount) {
      const hostEl = this.bodyEl
      if (!hostEl) {
        return {
          open: () => {},
          isOpen: () => false,
          openAccess: () => {},
          openModel: () => {},
          openLanguage: () => {},
          close: () => {},
          dispose: () => {},
        }
      }
      this.aiChatMount = mountAiChatPanel({
        hostEl,
        storage: getPdfStorage(),
        app: this.app,
        openCitedFile: (file, subpath) => this.plugin.openFileWithFoxycape(file, subpath),
        openCitedUrl: (url, subpath) => this.plugin.openUrlWithFoxycape(url, subpath),
        getLinkSource: this.resolveLinkSource,
        t: this.plugin.t,
        openSettings: () => {
          const setting = (this.app as unknown as {
            setting?: { open: () => void; openTabById?: (id: string) => void }
          }).setting
          setting?.open()
          setting?.openTabById?.(this.plugin.manifest.id)
        },
      })
    }
    return this.aiChatMount
  }

  private resolvePassageNoteSource(simpleId: string): { pdfFile?: TFile; sourceUrl?: string } | null {
    if (!simpleId) {
      return null
    }
    let matched: PdfReaderView | null = null
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (matched) {
        return
      }
      const view = leaf.view as {
        getViewType?: () => string
        getPdfSession?: () => PdfReaderView | null
      }
      if (view?.getViewType?.() !== PDF_READER_VIEW_TYPE) {
        return
      }
      const session = view.getPdfSession?.()
      if (session?.getReader()?.context?.id === simpleId) {
        matched = session
      }
    })
    if (!matched || (!matched.file && !matched.sourceUrl)) {
      return null
    }
    return {
      pdfFile: matched.file ?? undefined,
      sourceUrl: matched.sourceUrl || undefined,
    }
  }

  private unbindAiNoteWriter() {
    const runtime = tryGetAiRuntime()
    if (runtime && this.noteWriter && runtime.writePassageNote === this.noteWriter) {
      runtime.writePassageNote = undefined
    }
    this.noteWriter = null
  }

  private bindAiNoteWriter(_reader: Reader) {
    const runtime = tryGetAiRuntime()
    if (!runtime) {
      return
    }
    const write = async (input: PassageNoteWrite) => {
      if (input.kind === 'explain' && !this.plugin.settings.writeExplainToMarkdown) {
        return
      }
      if (input.kind === 'lookup' && !this.plugin.settings.writeLookupToMarkdown) {
        return
      }
      if (input.kind === 'translate' && !this.plugin.settings.writeTranslateToMarkdown) {
        return
      }
      const source = this.resolvePassageNoteSource(input.simpleId)
      if (!source) {
        return
      }
      try {
        await appendAiNote(this.app, source, input)
      } catch (error) {
        console.error('[Foxycape PDF] failed to write passage note', error)
        const message = error instanceof Error ? error.message : String(error)
        new Notice(
          this.plugin.t('plugin_notice_mark_note_sync_failed', 'Failed to write highlight note: {message}', {
            message,
          }),
        )
      }
    }
    this.noteWriter = write
    runtime.writePassageNote = write
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
        storage: getPdfStorage(),
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
        findPassageRange: (markId) => findPassageContentRange(getPdfStorage(), markId),
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

export const attachPdfReader = (surface: PdfReaderSurface) => new PdfReaderView(surface)
