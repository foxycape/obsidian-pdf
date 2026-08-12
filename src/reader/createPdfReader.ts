import {
  EventNames,
  Options,
  Reader,
  type ILocale,
  type IMarker,
  type IStorage,
} from '@foxycape/core/kernal'
import type { IPdfRenderer } from '@foxycape/core/mediaTypes/pdf/renderer/IPdfRenderer'
import { PdfMarker } from '@/marker/PdfMarker'
import { Platform, type App, type Plugin } from 'obsidian'
import {
  CustomPdfOptions,
  DEFAULT_PDF_VIEW_PREFERENCES,
  registerPdfMediaType,
  type PdfViewPreferences,
} from '@/reader/mediaTypes/pdf'
import {
  OBSIDIAN_THEME_NAME,
  ObsidianThemeProvider,
} from '@/reader/ObsidianThemeProvider'
import type { PdfAssetUrls } from '@/reader/pdfAssets'
import { createDiskPdfAssetInitializer } from '@/reader/pdfDiskAssetFactories'
import type { PdfImageLinkSource } from '@/obsidian/pdfImageRef'

export type CreatePdfReaderOptions = {
  app: App
  plugin: Plugin
  assets: PdfAssetUrls
  locale: ILocale
  /** Shared plugin storage (Dexie). Must outlive individual reader sessions. */
  storage: IStorage
  viewPreferences?: Partial<PdfViewPreferences>
  /** Runtime callback for image reference copy / paste pipeline. */
  getLinkSource?: () => PdfImageLinkSource | null
  /** Runtime gate for premium image actions after trial ends. */
  ensureEntitled?: () => boolean
  onRequirePassword: (
    callback: (password: string | Error) => Promise<void> | void,
    reason: string,
  ) => void | Promise<void>
}

export type PdfReaderSession = {
  reader: Reader
  /** PDF mark engine owned by the host app (not Reader core) */
  getMarker: () => IMarker | undefined
}

export const createPdfReader = async (
  options: CreatePdfReaderOptions,
): Promise<PdfReaderSession> => {
  // Worker Blob URL + disk cmap/font factories are installed before open.
  const readerOptions = new Options()
  readerOptions.debug = false
  readerOptions.enableHeader = false
  readerOptions.enableFooter = false
  readerOptions.themeName = OBSIDIAN_THEME_NAME

  const reader = new Reader(readerOptions, {
    locale: options.locale,
    storage: options.storage,
  })
  let marker: PdfMarker | undefined

  const disposeMarker = async () => {
    if (!marker) {
      return
    }
    await marker.dispose()
    marker = undefined
  }

  const themeProvider = new ObsidianThemeProvider()
  await themeProvider.initialize()
  reader.services.add('themeProvider', () => themeProvider)
  themeProvider.bindLiveSync(options.app, async () => {
    if (reader.disposed || !reader.loaded) {
      return
    }
    await reader.changeTheme(OBSIDIAN_THEME_NAME)
  })

  const pdfOptions = new CustomPdfOptions()
  pdfOptions.cMapUrl = options.assets.cMapUrl
  pdfOptions.standardFontDataUrl = options.assets.standardFontDataUrl
  pdfOptions.showPasswordPrompt = true
  pdfOptions.textLayerMode = Platform.isMobile ? 1 : 2;
  Object.assign(pdfOptions, DEFAULT_PDF_VIEW_PREFERENCES, options.viewPreferences)
  pdfOptions.getLinkSource = options.getLinkSource
  pdfOptions.ensureEntitled = options.ensureEntitled
  pdfOptions.documentInitParametersCallback = createDiskPdfAssetInitializer(
    options.plugin,
  )
  registerPdfMediaType(reader, pdfOptions)

  reader.onRenderered = async (renderer) => {
    await disposeMarker()
    marker = new PdfMarker(renderer as IPdfRenderer)
    await marker.initialize()
  }

  reader.events.on(
    EventNames.RequirePdfPassword,
    (
      callback: (password: string | Error) => Promise<void> | void,
      reason: string,
      _reasonType: number,
    ) => {
      void options.onRequirePassword(callback, reason)
    },
  )

  reader.events.on(EventNames.ReaderCleared, () => {
    void disposeMarker()
  })

  reader.events.on(EventNames.ReaderDisposed, () => {
    void disposeMarker()
    void themeProvider.dispose()
  })

  return {
    reader,
    getMarker: () => marker,
  }
}
