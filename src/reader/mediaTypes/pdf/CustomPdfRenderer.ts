import type {
  ExtractImageOptions,
  IFileParser,
  ImageDescriptor,
  Reader,
  Theme,
} from '@foxycape/core/kernal'
import { EventNames } from '@foxycape/core/kernal'
import type { PDFDocumentProxy } from '@foxycape/core/pdfjs/types/src/display/api'
import type { MultiPDFViewer } from '@foxycape/core/mediaTypes/pdf/renderer/MultiPdfViewer'
import { PdfRenderer } from '@foxycape/core/mediaTypes/pdf/renderer/PdfRenderer'
import { CustomPdfOptions, type PdfViewPreferencePatch } from './CustomPdfOptions'
import type { IPdfImageSource } from './image/IPdfImageSource'
import { PdfInternalImageController } from './image/PdfInternalImageController'
import { PdfThemeColorRemapper } from './PdfThemeColorRemapper'

type PdfLinkService = {
  getAnchorUrl: (hash: string) => string
  goToPage: (pageNumber: number) => void
  page?: number
  pdfDocument?: PDFDocumentProxy | null
}

/**
 * Obsidian PDF renderer with embedded-image preview and page color remapping.
 * getImage / getImages live here (not on IPdfRenderer).
 */
export class CustomPdfRenderer extends PdfRenderer implements IPdfImageSource {
  private readonly customOptions: CustomPdfOptions
  private imageController?: PdfInternalImageController
  private pdfThemeColorRemapper?: PdfThemeColorRemapper
  private isPageRenderBound = false
  private isRemapperReady = false
  private lastAppliedThemeKey: string | undefined

  constructor(
    owner: Reader,
    fileParser: IFileParser,
    readerContainer: HTMLElement,
    options: CustomPdfOptions,
  ) {
    super(owner, fileParser, readerContainer, options)
    this.customOptions = options
    // Must bind PdfPageRender hooks before pages draw.
    if (this.customOptions.enablePdfThemeColorRemap) {
      this.pdfThemeColorRemapper = new PdfThemeColorRemapper(
        this.owner,
        this.customOptions,
      )
      this.bindPageRender()
    }
    if (this.customOptions.enableViewPdfImages) {
      this.imageController = new PdfInternalImageController(
        this,
        this.customOptions,
        this.owner,
      )
    }
  }

  /** Expose pdf.js viewer for Obsidian chrome (thumbnails / page sync). */
  getPdfViewer = (): MultiPDFViewer => this.pdfViewer

  getCustomOptions = () => this.customOptions

  /**
   * Apply view preferences at runtime (settings panel).
   * Lazily creates remapper / image controller when first enabled.
   */
  applyViewPreferences = async (patch: PdfViewPreferencePatch) => {
    const nextImages = patch.enableViewPdfImages
    const nextRemap = patch.enablePdfThemeColorRemap
    const nextMode = patch.pdfThemeColorRemapMode
    const hasRendererPrefs =
      nextImages !== undefined || nextRemap !== undefined || nextMode !== undefined
    if (!hasRendererPrefs) {
      return
    }

    if (nextImages !== undefined) {
      this.customOptions.enableViewPdfImages = nextImages
    }
    if (nextRemap !== undefined) {
      this.customOptions.enablePdfThemeColorRemap = nextRemap
    }
    if (nextMode !== undefined) {
      this.customOptions.pdfThemeColorRemapMode = nextMode
    }

    if (this.customOptions.enablePdfThemeColorRemap) {
      if (!this.pdfThemeColorRemapper) {
        this.pdfThemeColorRemapper = new PdfThemeColorRemapper(
          this.owner,
          this.customOptions,
        )
        this.bindPageRender()
        this.isRemapperReady = false
        await this.ensureRemapperReady()
      } else {
        this.pdfThemeColorRemapper.refreshActiveState()
      }
    } else {
      this.pdfThemeColorRemapper?.refreshActiveState()
    }

    if (this.customOptions.enableViewPdfImages) {
      if (!this.imageController) {
        this.imageController = new PdfInternalImageController(
          this,
          this.customOptions,
          this.owner,
        )
      }
    } else {
      this.imageController?.clearPreviewUi()
    }

    this.refreshPages()
  }

  getLinkService = (): PdfLinkService => {
    const viewer = this.pdfViewer as any
    if (viewer?.options?.linkService) {
      return viewer.options.linkService as PdfLinkService
    }
    return {
      getAnchorUrl: (hash: string) => hash,
      goToPage: (pageNumber: number) => {
        this.currentPage = pageNumber
      },
      get page() {
        return viewer?.currentPageNumber as number
      },
    }
  }

  getPdfDocument = (): PDFDocumentProxy | null => {
    const viewer = this.pdfViewer as any
    return (viewer?.pdfDocument as PDFDocumentProxy | null) ??
      this.getLinkService().pdfDocument ??
      null
  }

  async getImages(
    options?: ExtractImageOptions,
    callback?: (url: string, images: ImageDescriptor[]) => void,
  ): Promise<ImageDescriptor[]> {
    const extractor = this.imageController?.getImageExtractor()
    if (!extractor) {
      return []
    }
    return extractor.getImages(options, callback)
  }

  async getImage(
    pageNumber: number,
    objId: string,
  ): Promise<ImageBitmap | HTMLCanvasElement | null> {
    const extractor = this.imageController?.getImageExtractor()
    if (!extractor) {
      return null
    }
    return extractor.getImage(pageNumber, objId)
  }

  override async load(
    location?: Parameters<PdfRenderer['load']>[0],
    isReload?: boolean,
  ): Promise<void> {
    await this.ensureRemapperReady()
    await super.load(location, isReload)
  }

  override async applyTheme(theme: Theme): Promise<void> {
    await this.ensureRemapperReady()
    const themeKey = this.getThemeKey(theme)
    const shouldRefreshPages =
      this.lastAppliedThemeKey != null && this.lastAppliedThemeKey !== themeKey
    this.pdfThemeColorRemapper?.setTheme(theme)
    await super.applyTheme(theme)
    this.lastAppliedThemeKey = themeKey
    // Canvas bitmaps keep the previous theme until redrawn.
    if (shouldRefreshPages) {
      this.refreshPagesForTheme()
    }
  }

  private getThemeKey = (theme: Theme) =>
    [
      theme.colorMode ?? '',
      theme.contentBackground ?? '',
      theme.contentTextColor ?? '',
    ].join('|')

  private refreshPagesForTheme = () => {
    if (!this.pdfThemeColorRemapper || !this.customOptions.enablePdfThemeColorRemap) {
      return
    }
    this.refreshPages()
  }

  private refreshPages = () => {
    const viewer = this.pdfViewer as
      | { pdfDocument?: unknown; refresh?: (noUpdate?: boolean) => void }
      | undefined
    if (!viewer?.pdfDocument || typeof viewer.refresh !== 'function') {
      return
    }
    viewer.refresh()
  }

  override async dispose(): Promise<void> {
    this.unbindPageRender()
    await this.pdfThemeColorRemapper?.dispose()
    this.pdfThemeColorRemapper = undefined
    await this.imageController?.dispose()
    this.imageController = undefined
    await super.dispose()
  }

  private ensureRemapperReady = async () => {
    if (!this.pdfThemeColorRemapper || this.isRemapperReady) {
      return
    }
    await this.pdfThemeColorRemapper.initialize()
    this.isRemapperReady = true
  }

  private bindPageRender = () => {
    if (this.isPageRenderBound) {
      return
    }
    this.owner.events.on(EventNames.PdfPageRender, this.onPdfPageRender)
    this.isPageRenderBound = true
  }

  private unbindPageRender = () => {
    if (!this.isPageRenderBound) {
      return
    }
    this.owner.events.off(EventNames.PdfPageRender, this.onPdfPageRender)
    this.isPageRenderBound = false
  }

  private onPdfPageRender = async (pageView: any) => {
    if (!this.pdfThemeColorRemapper || !pageView?.canvas || !pageView?.pdfPage) {
      return
    }
    const canvasContext = pageView.canvas.getContext('2d') as any
    canvasContext['imageDescriptors'] = null
    if (canvasContext['originalFillText'] || canvasContext['originalDrawImage']) {
      return
    }
    canvasContext['page'] = pageView.id

    const enableImages = this.customOptions.enableViewPdfImages
    this.pdfThemeColorRemapper.handle(
      canvasContext,
      pageView.pdfPage.view[2],
      pageView.pdfPage.view[3],
      {
        pageView,
        handleFill: true,
        handleFillText: true,
        handleFillRect: true,
        handleStroke: true,
        handleStrokeRect: true,
        handleStrokeText: true,
        handleDrawImage: true,
        imageMinWidth: this.customOptions.imageMinWidth,
        imageMinHeight: this.customOptions.imageMinHeight,
        imageCallback: enableImages
          ? (imageDescriptor) => {
              this.imageController
                ?.getImageExtractor()
                .setPageImageDescriptor(pageView.id, imageDescriptor)
            }
          : undefined,
      },
    )
  }
}
