/**
 * PDF rendering queue for thumbnails (adapted from pdf.js / linghuxiong).
 */

export type IRenderableView = {
  id: number
  renderingId: string
  renderingState: number
  draw: () => Promise<void>
  resume?: (() => void) | null
}

export type IPdfViewer = {
  forceRendering: (currentlyVisiblePages?: unknown) => boolean
}

export type IPdfThumbnailViewer = {
  forceRendering: () => boolean
}

type VisibleViews = {
  views: Array<{ id: number; view: IRenderableView }>
  first?: { id: number }
  last?: { id: number }
  ids: Set<number>
}

const CLEANUP_TIMEOUT = 30000

export const RenderingStates = {
  INITIAL: 0,
  RUNNING: 1,
  PAUSED: 2,
  FINISHED: 3,
} as const

export class PdfRenderingQueue {
  pdfViewer: IPdfViewer | null = null
  pdfThumbnailViewer: IPdfThumbnailViewer | null = null
  onIdle: (() => void) | null = null
  highestPriorityPage: string | null = null
  idleTimeout: number | null = null
  printing = false
  isThumbnailViewEnabled = false
  /** When true, thumbnails take priority over the main viewer. */
  preferThumbnails = false

  hasViewer = () => !!this.pdfViewer

  setViewer = (pdfViewer: IPdfViewer) => {
    this.pdfViewer = pdfViewer
  }

  setThumbnailViewer = (pdfThumbnailViewer: IPdfThumbnailViewer) => {
    this.pdfThumbnailViewer = pdfThumbnailViewer
  }

  isHighestPriority = (view: IRenderableView) =>
    this.highestPriorityPage === view.renderingId

  renderHighestPriority = (currentlyVisiblePages?: unknown) => {
    if (this.idleTimeout) {
      window.clearTimeout(this.idleTimeout)
      this.idleTimeout = null
    }

    if (this.preferThumbnails) {
      if (this.isThumbnailViewEnabled && this.pdfThumbnailViewer?.forceRendering()) {
        return
      }
      if (this.pdfViewer?.forceRendering(currentlyVisiblePages)) {
        return
      }
    } else {
      if (this.pdfViewer?.forceRendering(currentlyVisiblePages)) {
        return
      }
      if (this.isThumbnailViewEnabled && this.pdfThumbnailViewer?.forceRendering()) {
        return
      }
    }

    if (this.printing || !this.onIdle) {
      return
    }

    this.idleTimeout = window.setTimeout(() => {
      this.onIdle?.()
    }, CLEANUP_TIMEOUT)
  }

  getHighestPriority = (
    visible: VisibleViews,
    views: IRenderableView[],
    scrolledDown: boolean,
    preRenderExtra = false,
  ): IRenderableView | null => {
    const visibleViews = visible.views
    const numVisible = visibleViews.length
    if (numVisible === 0) {
      return null
    }

    for (let i = 0; i < numVisible; i++) {
      const view = visibleViews[i]?.view
      if (view && !this.isViewFinished(view)) {
        return view
      }
    }

    const firstId = visible.first?.id
    const lastId = visible.last?.id
    if (firstId === undefined || lastId === undefined) {
      return null
    }

    if (lastId - firstId + 1 > numVisible) {
      const visibleIds = visible.ids
      for (let i = 1, ii = lastId - firstId; i < ii; i++) {
        const holeId = scrolledDown ? firstId + i : lastId - i
        if (visibleIds.has(holeId)) {
          continue
        }
        const holeView = views[holeId - 1]
        if (holeView && !this.isViewFinished(holeView)) {
          return holeView
        }
      }
    }

    let preRenderIndex = scrolledDown ? lastId : firstId - 2
    let preRenderView = views[preRenderIndex]
    if (preRenderView && !this.isViewFinished(preRenderView)) {
      return preRenderView
    }

    if (preRenderExtra) {
      preRenderIndex += scrolledDown ? 1 : -1
      preRenderView = views[preRenderIndex]
      if (preRenderView && !this.isViewFinished(preRenderView)) {
        return preRenderView
      }
    }

    return null
  }

  isViewFinished = (view: IRenderableView) =>
    view.renderingState === RenderingStates.FINISHED

  renderView = (view: IRenderableView): boolean => {
    switch (view.renderingState) {
      case RenderingStates.FINISHED:
        return false
      case RenderingStates.PAUSED:
        this.highestPriorityPage = view.renderingId
        view.resume?.()
        break
      case RenderingStates.RUNNING:
        this.highestPriorityPage = view.renderingId
        break
      case RenderingStates.INITIAL:
        this.highestPriorityPage = view.renderingId
        void view
          .draw()
          .finally(() => {
            this.renderHighestPriority()
          })
          .catch((reason: { name?: string } | undefined) => {
            if (reason?.name === 'RenderingCancelledException') {
              return
            }
            console.error(`renderView: "${String(reason)}"`)
          })
        break
    }
    return true
  }

  cleanup = () => {
    if (this.idleTimeout) {
      window.clearTimeout(this.idleTimeout)
      this.idleTimeout = null
    }
    this.onIdle = null
    this.highestPriorityPage = null
  }
}
