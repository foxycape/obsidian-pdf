import type { PDFDocumentProxy, PDFPageProxy } from '@foxycape/core/pdfjs/types/src/display/api'
import { PdfRenderingQueue, RenderingStates } from './PdfRenderingQueue'
import { PdfThumbnailView } from './PdfThumbnailView'

type PdfEventBus = {
  on: (name: string, listener: (...args: unknown[]) => void) => void
  off?: (name: string, listener: (...args: unknown[]) => void) => void
}

type PdfLinkService = {
  getAnchorUrl: (hash: string) => string
  goToPage: (pageNumber: number) => void
  page?: number
}

type VisibleThumbs = {
  views: Array<{ id: number; x: number; y: number; view: PdfThumbnailView }>
  first?: { id: number; x: number; y: number; view: PdfThumbnailView }
  last?: { id: number; x: number; y: number; view: PdfThumbnailView }
  ids: Set<number>
}

/**
 * PDF thumbnail viewer (adapted from pdf.js / linghuxiong).
 * Renders visible thumbnails first via the rendering queue.
 */
export class PdfThumbnailViewer {
  readonly container: HTMLDivElement
  readonly eventBus: PdfEventBus
  readonly linkService: PdfLinkService
  renderingQueue: PdfRenderingQueue | null

  private pdfDocument: PDFDocumentProxy | null = null
  private pages: PdfThumbnailView[] = []
  private pageLabels: (string | null)[] | null = null
  private scale = 1
  private rotation = 0
  private pagesRotation = 0
  private currentPageNumber = 0
  private scrollDown = true
  private lastScrollTop = 0
  /** Bumped on each forceRendering to ignore stale getPage callbacks. */
  private renderGeneration = 0
  private readonly onScroll: () => void
  private readonly onUpdateThumbnails: () => void
  private readonly onPagesInit: () => void
  private readonly onPageChanging: (evt: { pageNumber?: number }) => void
  private readonly onScaleChanging: (evt: { scale?: number }) => void
  private readonly onRotationChanging: (evt: {
    rotation?: number
    pagesRotation?: number
  }) => void
  private readonly onSidebarViewChanged: (evt: { view?: number }) => void

  constructor(
    container: HTMLDivElement,
    eventBus: PdfEventBus,
    linkService: PdfLinkService,
    renderingQueue: PdfRenderingQueue | null = null,
  ) {
    this.container = container
    this.eventBus = eventBus
    this.linkService = linkService
    this.renderingQueue = renderingQueue
    this.container.classList.add('thumbnailView')

    this.onScroll = () => this.scrollUpdated()
    this.onUpdateThumbnails = () => this.requestRendering()
    this.onPagesInit = () => this.pagesInit()
    this.onPageChanging = (evt) => this.pageChanging(evt)
    this.onScaleChanging = (evt) => this.scaleChanging(evt)
    this.onRotationChanging = (evt) => this.rotationChanging(evt)
    this.onSidebarViewChanged = (evt) => this.sidebarViewChanged(evt)

    this.container.addEventListener('scroll', this.onScroll)
    this.eventBus.on('optionalcontentconfigchanged', this.onUpdateThumbnails)
    this.eventBus.on('pagesinit', this.onPagesInit)
    this.eventBus.on('pagechanging', this.onPageChanging)
    this.eventBus.on('scalechanging', this.onScaleChanging)
    this.eventBus.on('rotationchanging', this.onRotationChanging)
    this.eventBus.on('sidebarviewchanged', this.onSidebarViewChanged)
  }

  setDocument = (pdfDocument: PDFDocumentProxy | null) => {
    if (this.pdfDocument) {
      this.cancelRendering()
      this.reset()
    }
    this.pdfDocument = pdfDocument
    if (!pdfDocument) {
      return
    }

    void pdfDocument
      .getPage(1)
      .then((firstPdfPage: PDFPageProxy) => {
        if (this.pdfDocument !== pdfDocument) {
          return
        }
        const pagesCount = pdfDocument.numPages
        const viewport = firstPdfPage.getViewport({ scale: 1 })
        const staging = createDiv()

        this.pages = []
        for (let pageNum = 1; pageNum <= pagesCount; pageNum++) {
          const thumbnail = new PdfThumbnailView(
            staging,
            pageNum,
            this.linkService,
            this.renderingQueue,
            viewport,
          )
          this.pages.push(thumbnail)
        }

        this.pages[0]?.setPdfPage(firstPdfPage)
        while (staging.firstChild) {
          this.container.appendChild(staging.firstChild)
        }

        const currentPage = this.linkService.page || 1
        if (currentPage > 0 && currentPage <= this.pages.length) {
          this.updateActiveThumbnail(currentPage)
          window.requestAnimationFrame(() => {
            window.setTimeout(() => {
              this.scrollToPage(currentPage)
              this.requestRendering()
            }, 50)
          })
        } else {
          this.requestRendering()
        }
      })
      .catch((reason) => {
        console.error('Unable to initialize thumbnail viewer', reason)
      })
  }

  private reset = () => {
    this.container.textContent = ''
    this.pages = []
    this.pageLabels = null
    this.pdfDocument = null
    this.currentPageNumber = 0
    this.scrollDown = true
    this.lastScrollTop = 0
    this.renderGeneration = 0
  }

  private cancelRendering = () => {
    for (const thumbnail of this.pages) {
      thumbnail.cancelRendering()
    }
  }

  private pagesInit = () => {
    if (!this.pdfDocument || this.pages.length > 0) {
      return
    }
    this.setDocument(this.pdfDocument)
  }

  private ensurePdfPageLoaded = async (thumbView: PdfThumbnailView) => {
    if (thumbView.pdfPage) {
      return thumbView.pdfPage
    }
    if (!this.pdfDocument) {
      return null
    }
    try {
      const pdfPage = await this.pdfDocument.getPage(thumbView.id)
      if (!thumbView.pdfPage) {
        thumbView.setPdfPage(pdfPage)
      }
      return pdfPage
    } catch (reason) {
      console.error('Unable to get page for thumb view', reason)
      return null
    }
  }

  private pageChanging = (evt: { pageNumber?: number }) => {
    if (evt.pageNumber === undefined) {
      return
    }
    this.updateActiveThumbnail(evt.pageNumber)
    if (this.pages[evt.pageNumber - 1]) {
      this.scrollToPage(evt.pageNumber)
    }
  }

  private updateActiveThumbnail = (pageNumber: number) => {
    if (this.currentPageNumber > 0 && this.currentPageNumber <= this.pages.length) {
      this.pages[this.currentPageNumber - 1]?.anchor.classList.remove('active')
    }
    this.currentPageNumber = pageNumber
    if (pageNumber > 0 && pageNumber <= this.pages.length) {
      this.pages[pageNumber - 1]?.anchor.classList.add('active')
    }
  }

  private scaleChanging = (evt: { scale?: number }) => {
    if (evt.scale !== undefined) {
      this.scale = evt.scale
    }
  }

  private rotationChanging = (evt: {
    rotation?: number
    pagesRotation?: number
  }) => {
    if (evt.rotation !== undefined) {
      this.rotation = evt.rotation
    }
    if (evt.pagesRotation !== undefined) {
      this.pagesRotation = evt.pagesRotation
    }
    void this.rotation
    void this.pagesRotation
  }

  private sidebarViewChanged = (evt: { view?: number }) => {
    if (evt.view === 1) {
      this.requestRendering()
    }
  }

  private scrollUpdated = () => {
    const scrollTop = this.container.scrollTop
    this.scrollDown = scrollTop >= this.lastScrollTop
    this.lastScrollTop = scrollTop
    this.requestRendering()
  }

  private requestRendering = () => {
    if (this.renderingQueue) {
      this.renderingQueue.preferThumbnails = true
      this.renderingQueue.renderHighestPriority()
      return
    }
    void this.forceRendering()
  }

  private getVisibleThumbs = (): VisibleThumbs => {
    const top = this.container.scrollTop
    const bottom = top + this.container.clientHeight
    const left = this.container.scrollLeft
    const right = left + this.container.clientWidth
    const views: VisibleThumbs['views'] = []
    const ids = new Set<number>()

    for (const thumbnail of this.pages) {
      const element = thumbnail.anchor
      const elementTop = element.offsetTop
      const elementBottom = elementTop + Math.max(element.offsetHeight, 1)
      const elementLeft = element.offsetLeft
      const elementRight = elementLeft + Math.max(element.offsetWidth, 1)
      if (
        elementBottom > top &&
        elementTop < bottom &&
        elementRight > left &&
        elementLeft < right
      ) {
        const item = {
          id: thumbnail.id,
          x: elementLeft,
          y: elementTop,
          view: thumbnail,
        }
        views.push(item)
        ids.add(thumbnail.id)
      }
    }

    return {
      views,
      first: views[0],
      last: views[views.length - 1],
      ids,
    }
  }

  private getScrollAhead = (visible: VisibleThumbs) => {
    if (visible.first?.id === 1) {
      return true
    }
    if (visible.last?.id === this.pages.length) {
      return false
    }
    return this.scrollDown
  }

  private scrollToPage = (page: number) => {
    if (page < 1 || page > this.pages.length) {
      return
    }
    const thumbnail = this.pages[page - 1]
    if (!thumbnail) {
      return
    }
    const element = thumbnail.anchor
    const containerTop = this.container.scrollTop
    const containerBottom = containerTop + this.container.clientHeight
    const elementTop = element.offsetTop
    const elementBottom = elementTop + element.offsetHeight
    if (elementTop >= containerTop && elementBottom <= containerBottom) {
      return
    }
    this.container.scrollTop = elementTop - this.container.clientTop
  }

  forceRendering = () => {
    if (!this.renderingQueue || this.pages.length === 0) {
      return false
    }

    const visibleThumbs = this.getVisibleThumbs()
    const scrollAhead = this.getScrollAhead(visibleThumbs)
    const thumbView = this.renderingQueue.getHighestPriority(
      visibleThumbs,
      this.pages,
      scrollAhead,
      false,
    )

    if (!thumbView) {
      return false
    }

    // Cancel non-priority in-flight work so a fast scroll can jump to the
    // newly visible area instead of waiting on off-screen pages.
    for (const page of this.pages) {
      if (page === thumbView) {
        continue
      }
      if (
        page.renderingState === RenderingStates.RUNNING ||
        page.renderingState === RenderingStates.PAUSED
      ) {
        page.cancelRendering()
        page.renderingState = RenderingStates.INITIAL
      }
    }

    const generation = ++this.renderGeneration
    const target = thumbView as PdfThumbnailView

    void this.ensurePdfPageLoaded(target).then((pdfPage) => {
      if (generation !== this.renderGeneration || !this.renderingQueue) {
        return
      }
      if (!pdfPage) {
        this.renderingQueue.renderHighestPriority()
        return
      }
      // Re-check priority after async getPage ?user may have scrolled away.
      const latestVisible = this.getVisibleThumbs()
      const latest = this.renderingQueue.getHighestPriority(
        latestVisible,
        this.pages,
        this.getScrollAhead(latestVisible),
        false,
      )
      if (latest && latest.id === target.id) {
        if (target.renderingState !== RenderingStates.FINISHED) {
          this.renderingQueue.renderView(target)
        } else {
          this.renderingQueue.renderHighestPriority()
        }
      } else {
        this.renderingQueue.renderHighestPriority()
      }
    })

    return true
  }

  setPageLabels = (labels: (string | null)[] | null) => {
    this.pageLabels = labels
    if (!labels) {
      return
    }
    for (let i = 0; i < this.pages.length && i < labels.length; i++) {
      this.pages[i]?.setPageLabel(labels[i] ?? null)
    }
  }

  updatePageLabels = async () => {
    if (!this.pdfDocument) {
      return
    }
    try {
      const labels = await this.pdfDocument.getPageLabels()
      this.setPageLabels(labels)
    } catch (error) {
      console.error('Error getting page labels:', error)
    }
  }

  cleanup = () => {
    this.container.removeEventListener('scroll', this.onScroll)
    this.eventBus.off?.('optionalcontentconfigchanged', this.onUpdateThumbnails)
    this.eventBus.off?.('pagesinit', this.onPagesInit)
    this.eventBus.off?.('pagechanging', this.onPageChanging)
    this.eventBus.off?.('scalechanging', this.onScaleChanging)
    this.eventBus.off?.('rotationchanging', this.onRotationChanging)
    this.eventBus.off?.('sidebarviewchanged', this.onSidebarViewChanged)
    this.cancelRendering()
    this.reset()
  }
}
