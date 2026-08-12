import {
  asyncDebounce,
  EventNames,
  ImageActionDescriptor,
  type ImageDescriptor,
  type IDisposable,
  type Reader,
} from '@foxycape/core/kernal'
import { getFileName } from '@foxycape/core/kernal/common/path'
import { compareTagName } from '@foxycape/core/kernal/html/finder'
import {
  copyImage as copyImageToClipboard,
  getBlob,
} from '@foxycape/core/kernal/html/image'
import { injectCssContent, existsElement } from '@foxycape/core/kernal/html/injector'
import { parseNumber } from '@foxycape/core/kernal/common/number'
import type { IPdfDocument } from '@foxycape/core/mediaTypes/pdf/renderer/IPdfDocument'
import type * as pdfjsLib from '@foxycape/core/pdfjs/legacy/build/pdf.mjs'
import { Notice, setIcon } from 'obsidian'
import {
  clearPendingPdfImageRef,
  stagePdfImageRefCopy,
} from '@/obsidian/pdfImageRef'
import { buildPdfUserSpaceRectParam } from '@/obsidian/selectionLink'
import { asAugmentedCanvasContext } from '../canvasContextHooks'
import type { CustomPdfOptions } from '../CustomPdfOptions'
import type { CustomPdfRenderer } from '../CustomPdfRenderer'
import { PdfImageDetector } from './PdfImageDetector'
import { PdfImageExtractor } from './PdfImageExtractor'
import { getFlipOnlyMatrix, isFullPageInternalImage } from './pdfInternalImageUtils'
import { handleOnlyImages } from './pdfImageHandler'
import { PdfImageViewer } from './viewer'
import type { PdfImageViewerCallbacks } from './viewer'
import lensCss from './lens.css?raw'

type ImageExportAction = 'download' | 'copy' | 'copyReference'

type PdfPageWithView = {
  view?: number[]
}

type PdfPageViewLike = {
  canvas?: HTMLCanvasElement
  rotation?: number
  pdfPage?: PdfPageWithView
}

type PdfPageRenderView = PdfPageViewLike & {
  id: number
  pdfPage: PdfPageWithView
}

const LENS_BUTTON_SIZE_PX = 32
const LENS_GAP_PX = 6
const LENS_TOOLBAR_WIDTH_PX = LENS_BUTTON_SIZE_PX * 2 + LENS_GAP_PX
/** Inset from image right/bottom edges when placing the toolbar. */
const LENS_INSET_PX = 12
const HIDE_LENS_DELAY_MS = 50

/**
 * Wires page-render image hooks, hover/mobile lens UI, and PhotoSwipe preview.
 */
export class PdfInternalImageController implements IDisposable {
  private readonly detector: PdfImageDetector
  private readonly extractor: PdfImageExtractor
  private readonly surface: HTMLElement
  private readonly lensToolbar: HTMLElement
  private readonly browseButton: HTMLButtonElement
  private readonly moreWrap: HTMLElement
  private readonly moreButton: HTMLButtonElement
  private readonly downloadButton: HTMLButtonElement
  private readonly copyButton: HTMLButtonElement
  private readonly copyReferenceButton: HTMLButtonElement
  private readonly mobileLensHost: HTMLElement
  private imageViewer: PdfImageViewer | null = null
  private hideLensTimer: number | null = null
  private isPointerOverLens = false
  private currentDoc: IPdfDocument | null = null
  private currentDescriptor: ImageDescriptor | null = null
  private busyAction: ImageExportAction | null = null
  private readonly supportsHoverLens =
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches
  private readonly cssId = 'foxycape-pdf-image-lens-css'

  constructor(
    private readonly renderer: CustomPdfRenderer,
    private readonly options: CustomPdfOptions,
    private readonly reader: Reader,
  ) {
    this.extractor = new PdfImageExtractor({
      get numberOfPages() {
        return renderer.numberOfPages
      },
      getPage: async (pageNumber): Promise<pdfjsLib.PDFPageProxy | null> => {
        const pageView = renderer.getPageView(pageNumber)
        const pdfPage: unknown = pageView?.pdfPage
        if (!pdfPage || typeof pdfPage !== 'object') {
          return null
        }
        return pdfPage as pdfjsLib.PDFPageProxy
      },
      logger: reader.loggerFactory?.getLogger?.('PdfImageExtractor'),
    })
    this.detector = new PdfImageDetector(renderer, options)
    this.surface = renderer.getRendererContainer()

    const toolbar = this.createLensToolbar()
    this.lensToolbar = toolbar.root
    this.browseButton = toolbar.browseButton
    this.moreWrap = toolbar.moreWrap
    this.moreButton = toolbar.moreButton
    this.downloadButton = toolbar.downloadButton
    this.copyButton = toolbar.copyButton
    this.copyReferenceButton = toolbar.copyReferenceButton

    this.mobileLensHost = createDiv({ cls: 'foxycape-pdf-mobile-lenses' })
    this.surface.appendChild(this.lensToolbar)
    this.surface.appendChild(this.mobileLensHost)

    this.injectLensStyles()
    this.bindEvents()
    this.applyLocaleLabels()
  }

  getImageExtractor() {
    return this.extractor
  }

  /** Hide hover/mobile lenses when image preview is turned off at runtime. */
  clearPreviewUi = () => {
    this.hideLensNow()
    this.mobileLensHost.empty()
  }

  private injectLensStyles() {
    if (!existsElement(document.head, this.cssId) && lensCss) {
      injectCssContent(document.head, String(lensCss), false, this.cssId)
    }
  }

  private applyLocaleLabels() {
    const locale = this.reader.locale
    const browse = locale.getText('pdf_image_browse', 'View image')
    const more = locale.getText('pdf_image_more', 'More')
    const download = locale.getText('pdf_image_menu_download', 'Download image')
    const copy = locale.getText('pdf_image_menu_copy', 'Copy image')
    const copyReference = locale.getText(
      'pdf_image_menu_copy_reference',
      'Copy image reference',
    )
    this.browseButton.setAttribute('aria-label', browse)
    this.moreButton.setAttribute('aria-label', more)
    this.downloadButton.setAttribute('aria-label', download)
    this.copyButton.setAttribute('aria-label', copy)
    this.copyReferenceButton.setAttribute('aria-label', copyReference)
    const downloadLabel = this.downloadButton.querySelector(
      '.foxycape-pdf-image-menu__label',
    )
    const copyLabel = this.copyButton.querySelector('.foxycape-pdf-image-menu__label')
    const copyReferenceLabel = this.copyReferenceButton.querySelector(
      '.foxycape-pdf-image-menu__label',
    )
    if (downloadLabel) {
      downloadLabel.textContent = download
    }
    if (copyLabel) {
      copyLabel.textContent = copy
    }
    if (copyReferenceLabel) {
      copyReferenceLabel.textContent = copyReference
    }
  }

  private createLensToolbar() {
    const root = createDiv({ cls: 'foxycape-pdf-image-toolbar' })

    const moreWrap = root.createDiv({ cls: 'foxycape-pdf-image-more-wrap' })

    const moreButton = moreWrap.createEl('button', {
      cls: 'clickable-icon foxycape-pdf-image-lens foxycape-pdf-image-lens--more',
      attr: { type: 'button' },
    })
    setIcon(moreButton, 'ellipsis-vertical')

    const menuEl = moreWrap.createDiv({ cls: 'foxycape-pdf-image-menu' })
    menuEl.setAttribute('role', 'menu')

    const downloadButton = this.createMenuItem('download', 'Download image')
    const copyButton = this.createMenuItem('copy', 'Copy image')
    const copyReferenceButton = this.createMenuItem('link', 'Copy image reference')
    menuEl.appendChild(downloadButton)
    menuEl.appendChild(copyButton)
    menuEl.appendChild(copyReferenceButton)

    const browseButton = root.createEl('button', {
      cls: 'clickable-icon foxycape-pdf-image-lens foxycape-pdf-image-lens--browse',
      attr: { type: 'button' },
    })
    setIcon(browseButton, 'search')


    const markPointerOver = () => {
      this.isPointerOverLens = true
      this.cancelHideLens()
    }
    const markPointerLeave = () => {
      this.isPointerOverLens = false
      this.closeMoreMenu()
      this.scheduleHideLens()
    }

    root.addEventListener('mouseenter', markPointerOver)
    root.addEventListener('mouseleave', markPointerLeave)

    browseButton.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      void this.openCurrentImage()
    })

    moreButton.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      // Touch / keyboard: toggle; hover already reveals the menu via CSS.
      moreWrap.classList.toggle('is-open')
    })

    downloadButton.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      void this.runExportAction('download')
    })

    copyButton.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      void this.runExportAction('copy')
    })

    copyReferenceButton.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      void this.runExportAction('copyReference')
    })

    return {
      root,
      browseButton,
      moreWrap,
      moreButton,
      downloadButton,
      copyButton,
      copyReferenceButton,
    }
  }

  private createMenuItem(icon: string, fallbackLabel: string) {
    const button = createEl('button', {
      cls: 'foxycape-pdf-image-menu__item clickable-icon',
      attr: { type: 'button', role: 'menuitem' },
    })
    setIcon(button, icon)
    button.createSpan({
      cls: 'foxycape-pdf-image-menu__label',
      text: fallbackLabel,
    })
    return button
  }

  private closeMoreMenu() {
    this.moreWrap.classList.remove('is-open')
  }

  private bindEvents() {
    const events = this.reader.events
    events.on(EventNames.PdfPageRender, this.onPdfPageRender)
    events.on(EventNames.PdfPageRendered, this.onPdfPageRendered)
    events.on(EventNames.DocumentMouseMove, this.checkContainsImage)
    events.on(EventNames.DocumentMouseEnter, this.checkContainsImage)
    events.on(EventNames.ReaderOriginalScroll, this.delayCheckContainsImage)
    events.on(EventNames.DocumentMouseLeave, this.onMouseLeave)
    events.on(EventNames.PdfScaleChanging, this.onScaleChanging)
  }

  private unbindEvents() {
    const events = this.reader.events
    events.off(EventNames.PdfPageRender, this.onPdfPageRender)
    events.off(EventNames.PdfPageRendered, this.onPdfPageRendered)
    events.off(EventNames.DocumentMouseMove, this.checkContainsImage)
    events.off(EventNames.DocumentMouseEnter, this.checkContainsImage)
    events.off(EventNames.ReaderOriginalScroll, this.delayCheckContainsImage)
    events.off(EventNames.DocumentMouseLeave, this.onMouseLeave)
    events.off(EventNames.PdfScaleChanging, this.onScaleChanging)
  }

  private onScaleChanging = () => {
    this.hideLensNow()
    this.mobileLensHost.empty()
  }

  private onPdfPageRender = (pageView: PdfPageRenderView) => {
    void this.handlePdfPageRender(pageView)
  }

  private handlePdfPageRender = async (pageView: PdfPageRenderView) => {
    if (!this.options.enableViewPdfImages || !pageView?.canvas) {
      return
    }
    // When theme remap is on, PdfThemeColorRemapper owns canvas draw hooks.
    if (this.options.enablePdfThemeColorRemap) {
      return
    }
    const rawContext = pageView.canvas.getContext('2d')
    if (!rawContext) {
      return
    }
    const canvasContext = asAugmentedCanvasContext(rawContext)
    canvasContext.imageDescriptors = null
    if (canvasContext.originalDrawImage) {
      return
    }
    canvasContext.page = pageView.id
    handleOnlyImages(canvasContext, pageView.pdfPage.view?.[2] ?? 0, pageView.pdfPage.view?.[3] ?? 0, {
      pageView,
      handleDrawImage: true,
      imageMinWidth: this.options.imageMinWidth,
      imageMinHeight: this.options.imageMinHeight,
      imageCallback: (imageDescriptor) => {
        this.extractor.setPageImageDescriptor(pageView.id, imageDescriptor)
      },
    })
  }

  private onPdfPageRendered = (payload: {
    pageView: { canvas?: HTMLCanvasElement; id: number; width: number; height: number }
    pageNumber: number
  }) => {
    void this.handlePdfPageRendered(payload)
  }

  private handlePdfPageRendered = async ({
    pageView,
    pageNumber,
  }: {
    pageView: { canvas?: HTMLCanvasElement; id: number; width: number; height: number }
    pageNumber: number
  }) => {
    if (!this.options.enableViewPdfImages || this.supportsHoverLens) {
      return
    }
    const canvas = pageView.canvas
    if (!canvas) {
      return
    }
    const rawContext = canvas.getContext('2d')
    if (!rawContext) {
      return
    }
    const canvasContext = asAugmentedCanvasContext(rawContext)
    const imageDescriptors = canvasContext.imageDescriptors ?? []
    const doc = this.renderer.getDocument((pageNumber - 1).toString())
    if (!doc) {
      return
    }
    this.renderMobileLenses(doc, imageDescriptors, pageView)
  }

  private renderMobileLenses(
    doc: IPdfDocument,
    descriptors: ImageDescriptor[],
    pageView: { width: number; height: number },
  ) {
    this.mobileLensHost
      .querySelectorAll(`[data-page="${doc.pageNumber}"]`)
      .forEach((el) => el.remove())

    for (const descriptor of descriptors) {
      if (isFullPageInternalImage(descriptor, pageView.width, pageView.height)) {
        continue
      }
      const position = this.computeLensPosition(doc, descriptor)
      if (!position) {
        continue
      }

      const toolbar = this.createMobileToolbar(doc, descriptor)
      toolbar.setCssStyles({
        left: `${position.left}px`,
        top: `${position.top}px`,
      })
      toolbar.classList.add('is-visible')
      toolbar.dataset.page = String(doc.pageNumber)
      this.mobileLensHost.appendChild(toolbar)
    }
  }

  private createMobileToolbar(doc: IPdfDocument, descriptor: ImageDescriptor) {
    const root = createDiv({ cls: 'foxycape-pdf-image-toolbar' })

    const moreWrap = root.createDiv({ cls: 'foxycape-pdf-image-more-wrap' })

    const moreButton = moreWrap.createEl('button', {
      cls: 'clickable-icon foxycape-pdf-image-lens foxycape-pdf-image-lens--more',
      attr: { type: 'button' },
    })
    setIcon(moreButton, 'ellipsis-vertical')
    moreButton.setAttribute(
      'aria-label',
      this.reader.locale.getText('pdf_image_more', 'More'),
    )

    const menuEl = moreWrap.createDiv({ cls: 'foxycape-pdf-image-menu' })
    menuEl.setAttribute('role', 'menu')

    const downloadLabel = this.reader.locale.getText(
      'pdf_image_menu_download',
      'Download image',
    )
    const copyLabel = this.reader.locale.getText(
      'pdf_image_menu_copy',
      'Copy image',
    )
    const copyReferenceLabel = this.reader.locale.getText(
      'pdf_image_menu_copy_reference',
      'Copy image reference',
    )
    const downloadButton = this.createMenuItem('download', downloadLabel)
    const copyButton = this.createMenuItem('copy', copyLabel)
    const copyReferenceButton = this.createMenuItem('link', copyReferenceLabel)
    menuEl.appendChild(downloadButton)
    menuEl.appendChild(copyButton)
    menuEl.appendChild(copyReferenceButton)

    const browseButton = root.createEl('button', {
      cls: 'clickable-icon foxycape-pdf-image-lens foxycape-pdf-image-lens--browse',
      attr: { type: 'button' },
    })
    setIcon(browseButton, 'search')
    browseButton.setAttribute(
      'aria-label',
      this.reader.locale.getText('pdf_image_browse', 'View image'),
    )


    moreButton.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      moreWrap.classList.toggle('is-open')
    })

    browseButton.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      void this.openViewer(doc, descriptor)
    })

    const menuButtons = {
      downloadButton,
      copyButton,
      copyReferenceButton,
    }

    downloadButton.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      void this.exportImage(doc, descriptor, 'download', menuButtons)
    })

    copyButton.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      void this.exportImage(doc, descriptor, 'copy', menuButtons)
    })

    copyReferenceButton.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      void this.exportImage(doc, descriptor, 'copyReference', menuButtons)
    })

    return root
  }

  private resolvePointerOffset = (e: MouseEvent, doc: IPdfDocument) => {
    const pageView = this.renderer.getPageView(doc.pageNumber)
    const canvas = pageView?.canvas
    if (!canvas) {
      return null
    }
    const target = e.target as Element
    if (compareTagName(target?.tagName, 'CANVAS') && target === canvas) {
      return { offsetX: e.offsetX, offsetY: e.offsetY }
    }
    const rect = canvas.getBoundingClientRect()
    return {
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    }
  }

  private resolveDocFromEvent = (e: Event, doc?: IPdfDocument): IPdfDocument | null => {
    if (doc) {
      return doc
    }
    const target = e.target as Element
    const pageContainer = target?.closest?.('.page')
    if (!pageContainer) {
      return null
    }
    const pageNumber = parseNumber(
      pageContainer.getAttribute('data-page-number') ?? '',
      0,
      'parseInt',
    )
    if (!pageNumber) {
      return null
    }
    return this.renderer.getDocument((pageNumber - 1).toString())
  }

  private checkContainsImage = (e: PointerEvent, doc?: IPdfDocument) => {
    void this.checkContainsImageAsync(e, doc)
  }

  private checkContainsImageAsync = async (e: PointerEvent, doc?: IPdfDocument) => {
    if (!this.options.enableViewPdfImages || !this.supportsHoverLens) {
      return
    }
    // Keep toolbar visible while interacting with it (incl. popup menu).
    if (this.isPointerOverLens) {
      return
    }
    const resolved = this.resolveDocFromEvent(e, doc)
    if (!resolved) {
      this.scheduleHideLens()
      return
    }
    const offset = this.resolvePointerOffset(e, resolved)
    if (!offset) {
      this.scheduleHideLens()
      return
    }
    const imageDescriptor = await this.detector.findImageDescriptor(
      offset.offsetX,
      offset.offsetY,
      resolved,
    )
    if (!imageDescriptor) {
      this.scheduleHideLens()
      return
    }
    this.showHoverLens(resolved, imageDescriptor)
  }

  private delayCheckContainsImageAsync = asyncDebounce(this.checkContainsImageAsync, 50)

  private delayCheckContainsImage = (e: PointerEvent, doc?: IPdfDocument) => {
    void this.delayCheckContainsImageAsync(e, doc)
  }

  private onMouseLeave = (e: MouseEvent, doc: IPdfDocument) => {
    if (!this.options.enableViewPdfImages) {
      return
    }
    const pageContainer = doc?.getContentContainer?.()
    if (!pageContainer || (e.target as Element) !== pageContainer) {
      return
    }
    this.scheduleHideLens()
  }

  private computeLensPosition(doc: IPdfDocument, imageDescriptor: ImageDescriptor) {
    // Image x/y/scaled* are in canvas backing-store pixels; place toolbar in surface
    // content coordinates (surface is the scroll container).
    const pageView = this.renderer.getPageView(doc.pageNumber)
    const canvas = pageView?.canvas
    if (!canvas) {
      return null
    }
    const dpr = window.devicePixelRatio ?? 1
    const changeOrientation = ((pageView.rotation ?? 0) % 180) !== 0
    const scaledWidth = (imageDescriptor.scaledWidth ?? 0) / dpr
    const scaledHeight = (imageDescriptor.scaledHeight ?? 0) / dpr
    const imgRight =
      (imageDescriptor.x ?? 0) / dpr + (changeOrientation ? scaledHeight : scaledWidth)
    const imgBottom =
      (imageDescriptor.y ?? 0) / dpr + (changeOrientation ? scaledWidth : scaledHeight)
    const canvasRect = canvas.getBoundingClientRect()
    const surfaceRect = this.surface.getBoundingClientRect()
    return {
      left:
        canvasRect.left -
        surfaceRect.left +
        this.surface.scrollLeft +
        imgRight -
        LENS_TOOLBAR_WIDTH_PX -
        LENS_INSET_PX,
      top:
        canvasRect.top -
        surfaceRect.top +
        this.surface.scrollTop +
        imgBottom -
        LENS_BUTTON_SIZE_PX -
        LENS_INSET_PX,
    }
  }

  private showHoverLens(doc: IPdfDocument, descriptor: ImageDescriptor) {
    const position = this.computeLensPosition(doc, descriptor)
    if (!position) {
      return
    }
    this.cancelHideLens()
    // Keep a stable corner while hovering the same image (avoid subpixel jitter).
    if (
      this.lensToolbar.classList.contains('is-visible') &&
      this.currentDescriptor?.id === descriptor.id
    ) {
      this.currentDoc = doc
      this.currentDescriptor = descriptor
      return
    }
    this.currentDoc = doc
    this.currentDescriptor = descriptor
    this.closeMoreMenu()
    this.lensToolbar.classList.add('is-visible')
    this.lensToolbar.setCssStyles({
      left: `${position.left}px`,
      top: `${position.top}px`,
    })
  }

  private cancelHideLens() {
    if (this.hideLensTimer) {
      window.clearTimeout(this.hideLensTimer)
      this.hideLensTimer = null
    }
  }

  private scheduleHideLens() {
    if (this.isPointerOverLens) {
      return
    }
    this.cancelHideLens()
    this.hideLensTimer = window.setTimeout(() => {
      this.hideLensTimer = null
      if (this.isPointerOverLens) {
        return
      }
      this.hideLensNow()
    }, HIDE_LENS_DELAY_MS)
  }

  private hideLensNow() {
    this.cancelHideLens()
    this.closeMoreMenu()
    this.lensToolbar.classList.remove('is-visible')
    this.currentDoc = null
    this.currentDescriptor = null
  }

  private async openCurrentImage() {
    if (!this.currentDoc || !this.currentDescriptor) {
      return
    }
    await this.openViewer(this.currentDoc, this.currentDescriptor)
  }

  private async runExportAction(action: ImageExportAction) {
    if (!this.currentDoc || !this.currentDescriptor) {
      return
    }
    await this.exportImage(this.currentDoc, this.currentDescriptor, action, {
      downloadButton: this.downloadButton,
      copyButton: this.copyButton,
      copyReferenceButton: this.copyReferenceButton,
    })
  }

  private async exportImage(
    doc: IPdfDocument,
    descriptor: ImageDescriptor,
    action: ImageExportAction,
    buttons: {
      downloadButton: HTMLButtonElement
      copyButton: HTMLButtonElement
      copyReferenceButton: HTMLButtonElement
    },
  ) {
    if (this.options.ensureEntitled && !this.options.ensureEntitled()) {
      return
    }
    if (this.busyAction) {
      return
    }
    this.busyAction = action
    buttons.downloadButton.disabled = true
    buttons.copyButton.disabled = true
    buttons.copyReferenceButton.disabled = true
    try {
      descriptor.docUrl = String(doc.pageNumber)
      const image = await this.extractor.getImage(doc.pageNumber, descriptor.imageUrl)
      if (!image) {
        throw new Error('Image not found')
      }
      const matrix = getFlipOnlyMatrix(descriptor.matrix)
      if (action === 'download') {
        const blobObject = await getBlob(image, matrix)
        const fileName = getFileName(descriptor.imageUrl + blobObject.extension)
        await this.downloadBlob(fileName, blobObject.data)
        new Notice(this.reader.locale.getText('pdf_image_downloaded', 'Image downloaded'))
      } else if (action === 'copyReference') {
        const linkSource = this.options.getLinkSource?.() ?? null
        if (!linkSource) {
          new Notice(
            this.reader.locale.getText(
              'pdf_image_ref_unavailable',
              'Unable to create image reference',
            ),
          )
          return
        }
        const blobObject = await getBlob(image, matrix)
        await stagePdfImageRefCopy({
          pngBlob: blobObject.data,
          pdfFile: linkSource.pdfFile,
          pageNumber: doc.pageNumber,
          kind: 'embed',
          nameHint: descriptor.imageRefId || descriptor.imageUrl,
          rect: this.resolveImageRectParam(doc.pageNumber, descriptor),
        })
        new Notice(
          this.reader.locale.getText(
            'pdf_image_ref_copied',
            'Image reference copied -- paste into Markdown, then right-click the image to open its PDF location in Foxycape',
          ),
        )
      } else {
        clearPendingPdfImageRef()
        await copyImageToClipboard(image, matrix)
        new Notice(this.reader.locale.getText('pdf_image_copied', 'Image copied'))
      }
    } catch {
      const template = this.reader.locale.getText(
        'pdf_image_error',
        'Image action failed: {message}',
      )
      new Notice(template.replace('{message}', action))
    } finally {
      this.busyAction = null
      buttons.downloadButton.disabled = false
      buttons.copyButton.disabled = false
      buttons.copyReferenceButton.disabled = false
    }
  }

  private async downloadBlob(fileName: string, blob: Blob) {
    const url = URL.createObjectURL(blob)
    try {
      const a = createEl('a')
      a.href = url
      a.download = fileName
      a.click()
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  private resolveImageRectParam = (
    pageNumber: number,
    descriptor: ImageDescriptor,
  ): string | undefined => {
    const pageView = this.renderer.getPageView(pageNumber) as PdfPageViewLike | undefined
    const canvas = pageView?.canvas
    const view = pageView?.pdfPage?.view
    if (!canvas || !view || view.length < 4) {
      return undefined
    }
    const pageOriginWidth = view[2]
    const pageOriginHeight = view[3]
    if (typeof pageOriginWidth !== 'number' || typeof pageOriginHeight !== 'number') {
      return undefined
    }
    const x = descriptor.x
    const y = descriptor.y
    const width = descriptor.scaledWidth
    const height = descriptor.scaledHeight
    if (x == null || y == null || width == null || height == null) {
      return undefined
    }
    // Match image-dest helpers: page media box width/height from view[2]/view[3].
    return buildPdfUserSpaceRectParam({
      x,
      y,
      width,
      height,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      pageOriginWidth,
      pageOriginHeight,
    })
  }

  private async ensureViewer() {
    if (this.imageViewer) {
      return this.imageViewer
    }
    const locale = this.reader.locale
    const callbacks: PdfImageViewerCallbacks = {
      texts: {
        copy: locale.getText('pdf_image_copy', 'Copy image'),
        copyReference: locale.getText(
          'pdf_image_menu_copy_reference',
          'Copy image reference',
        ),
        download: locale.getText('pdf_image_download', 'Download image'),
        rotate: locale.getText('pdf_image_rotate', 'Rotate'),
        close: locale.getText('pdf_image_close', 'Close'),
        loading: locale.getText('pdf_image_loading', 'Loading...'),
        copied: locale.getText('pdf_image_copied', 'Image copied'),
        referenceCopied: locale.getText(
          'pdf_image_ref_copied',
          'Image reference copied -- paste into Markdown, then right-click the image to open its PDF location in Foxycape',
        ),
        downloaded: locale.getText('pdf_image_downloaded', 'Image downloaded'),
        error: locale.getText('pdf_image_error', 'Image action failed: {message}'),
      },
      getLinkSource: () => this.options.getLinkSource?.() ?? null,
      resolveImageRect: (descriptor, pageNumber) =>
        this.resolveImageRectParam(pageNumber, descriptor),
      downloadFile: async (fileName, blob) => {
        await this.downloadBlob(fileName, blob)
      },
    }
    this.imageViewer = new PdfImageViewer(
      this.reader,
      this.renderer,
      document.body,
      callbacks,
      { fullscreen: true, zIndex: 10000 },
    )
    return this.imageViewer
  }

  private async openViewer(doc: IPdfDocument, descriptor: ImageDescriptor) {
    if (this.options.ensureEntitled && !this.options.ensureEntitled()) {
      return
    }
    this.browseButton.classList.add('is-loading')
    try {
      // 1-based page number for getImage / PdfImageViewer.resolvePageNumber
      descriptor.docUrl = String(doc.pageNumber)
      const viewer = await this.ensureViewer()
      const action = new ImageActionDescriptor()
      action.doc = doc
      action.imageUrl = descriptor.imageUrl
      action.imageDescriptors = [descriptor]
      action.from = 'direct'
      this.reader.events.emit(EventNames.ImageClicked, action)
      await viewer.show(descriptor)
    } finally {
      this.browseButton.classList.remove('is-loading')
    }
  }

  async dispose(): Promise<void> {
    this.unbindEvents()
    this.cancelHideLens()
    this.hideLensNow()
    this.mobileLensHost.remove()
    this.lensToolbar.remove()
    await this.imageViewer?.dispose()
    this.imageViewer = null
    await this.detector.dispose()
    await this.extractor.dispose()
  }
}
