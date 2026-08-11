import type {
  PDFPageProxy,
  RenderTask,
} from '@foxycape/core/pdfjs/types/src/display/api'
import { PdfRenderingQueue, RenderingStates } from './PdfRenderingQueue'

const THUMBNAIL_CANVAS_BORDER_WIDTH = 1
export const THUMBNAIL_WIDTH = 180

type PdfLinkService = {
  getAnchorUrl: (hash: string) => string
  goToPage: (pageNumber: number) => void
}

/**
 * Single-page PDF thumbnail view (adapted from pdf.js / linghuxiong).
 */
export class PdfThumbnailView {
  readonly id: number
  readonly div: HTMLDivElement
  readonly anchor: HTMLAnchorElement
  readonly canvas: HTMLCanvasElement
  renderingState: number = RenderingStates.INITIAL
  readonly renderingId: string
  pageLabel: string | null = null
  pdfPage: PDFPageProxy | null = null
  rotation = 0
  scale = 0.15
  width = 0
  height = 0
  pageWidth = 0
  pageHeight = 0
  renderingTask: RenderTask | null = null
  resume: (() => void) | null = null
  loaded = false

  private readonly linkService: PdfLinkService
  private readonly renderingQueue: PdfRenderingQueue | null
  private canvasWidth = 0
  private canvasHeight = 0

  constructor(
    container: HTMLDivElement,
    id: number,
    linkService: PdfLinkService,
    renderingQueue: PdfRenderingQueue | null,
    defaultViewport?: { width: number; height: number; rotation: number },
  ) {
    this.id = id
    this.linkService = linkService
    this.renderingQueue = renderingQueue
    this.renderingId = `thumbnail-${id}`

    const anchor = createEl('a', {
      cls: 'thumbnail',
      attr: {
        href: linkService.getAnchorUrl(`#page=${id}`),
        title: `${id}`,
        'data-page-number': String(id),
      },
    })

    const div = anchor.createDiv({ cls: 'thumbnailSelectionRing' })
    void THUMBNAIL_CANVAS_BORDER_WIDTH

    const canvas = div.createEl('canvas')
    canvas.width = 0
    canvas.height = 0

    anchor.createDiv({
      cls: 'thumbnail-page-label',
      text: String(id),
    })
    container.appendChild(anchor)

    this.anchor = anchor
    this.div = div
    this.canvas = canvas

    if (defaultViewport) {
      this.pageWidth = defaultViewport.width
      this.pageHeight = defaultViewport.height
      this.rotation = 0
      this.applyThumbnailSize(1)
    }

    anchor.addEventListener('click', (e: MouseEvent) => {
      linkService.goToPage(id)
      anchor.blur()
      e.preventDefault()
    })
  }

  setPdfPage = (pdfPage: PDFPageProxy) => {
    this.pdfPage = pdfPage
    this.update(1)
  }

  reset = () => {
    this.cancelRendering()
    this.renderingTask = null
    this.pdfPage = null
    this.renderingState = RenderingStates.INITIAL
    this.pageLabel = null
    this.canvas.width = 0
    this.canvas.height = 0
    this.loaded = false
  }

  private applyThumbnailSize = (scale: number) => {
    if (!this.pageWidth || !this.pageHeight) {
      return
    }
    const thumbnailScale = Math.min(
      THUMBNAIL_WIDTH / this.pageWidth,
      THUMBNAIL_WIDTH / this.pageHeight,
    )
    this.scale = thumbnailScale * scale
    this.width = Math.floor(this.pageWidth * thumbnailScale)
    this.height = Math.floor(this.pageHeight * thumbnailScale)
    this.canvasWidth = this.width
    this.canvasHeight = this.height
    this.canvas.width = this.canvasWidth
    this.canvas.height = this.canvasHeight
    this.div.style.width = `${this.width}px`
    this.div.style.height = `${this.height}px`
  }

  update = (scale: number) => {
    if (this.renderingState !== RenderingStates.INITIAL) {
      this.cancelRendering()
    }
    this.renderingState = RenderingStates.INITIAL
    this.loaded = false
    const pdfPage = this.pdfPage
    if (!pdfPage) {
      return
    }
    const totalRotation = (this.rotation + pdfPage.rotate) % 360
    const viewport = pdfPage.getViewport({ scale: 1, rotation: totalRotation })
    this.pageWidth = viewport.width
    this.pageHeight = viewport.height
    this.applyThumbnailSize(scale)
    this.div.setAttribute(
      'aria-label',
      `Thumbnail of Page ${this.pageLabel !== null ? this.pageLabel : this.id}`,
    )
  }

  cancelRendering = () => {
    if (this.renderingTask) {
      this.renderingTask.cancel()
      this.renderingTask = null
    }
    this.resume = null
  }

  draw = async () => {
    if (this.renderingState !== RenderingStates.INITIAL) {
      console.error('Must be in new state before drawing')
      return
    }

    const pdfPage = this.pdfPage
    if (!pdfPage) {
      // Page not loaded yet — leave as INITIAL so the queue can retry.
      return
    }

    this.renderingState = RenderingStates.RUNNING

    const totalRotation = (this.rotation + pdfPage.rotate) % 360
    const viewport = pdfPage.getViewport({
      scale: this.scale,
      rotation: totalRotation,
    })
    const canvasContext = this.canvas.getContext('2d')
    if (!canvasContext) {
      this.renderingState = RenderingStates.FINISHED
      return
    }

    const renderContinueCallback = (cont: () => void) => {
      if (!this.renderingQueue?.isHighestPriority(this)) {
        this.renderingState = RenderingStates.PAUSED
        this.resume = () => {
          this.renderingState = RenderingStates.RUNNING
          cont()
        }
        return
      }
      cont()
    }

    const renderTask = pdfPage.render({ canvasContext, viewport })
    this.renderingTask = renderTask
    renderTask.onContinue = renderContinueCallback

    try {
      await renderTask.promise
      this.renderingState = RenderingStates.FINISHED
      this.loaded = true
    } catch (reason: unknown) {
      const name = (reason as { name?: string } | null)?.name
      if (name === 'RenderingCancelledException') {
        this.renderingState = RenderingStates.INITIAL
        return
      }
      console.error('Error rendering thumbnail:', reason)
      this.renderingState = RenderingStates.FINISHED
    } finally {
      if (this.renderingTask === renderTask) {
        this.renderingTask = null
      }
    }
  }

  setPageLabel = (label: string | null) => {
    this.pageLabel = label
    this.anchor.title = String(this.id)
    this.div.setAttribute(
      'aria-label',
      `Thumbnail of Page ${label !== null ? label : this.id}`,
    )
    const pageLabelElement = this.anchor.querySelector<HTMLElement>(
      '.thumbnail-page-label',
    )
    if (pageLabelElement) {
      pageLabelElement.textContent = String(this.id)
    }
  }
}
