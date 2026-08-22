import type { IMarker } from '@foxycape/core/kernal/mark/IMarker'
import type { IPdfRenderer } from '@foxycape/core/mediaTypes/pdf/renderer/IPdfRenderer'
import {
  playGotoHighlightAnimation,
  waitForPageRendered,
} from '@/marker/PdfGotoAnimation'
import {
  measureConvertedMatchRects,
  type PdfConvertedMatch,
} from '@/search/matchGeometry'
import { MARK_HIGHLIGHT_ID_ATTR } from '@foxycape/core/kernal/mark/MarkConstants'
import {
  paintSearchHitOnPage,
  removeAllSearchOverlays,
} from '@/search/PdfSearchOverlay'
import type { PdfSearchMatch } from '@/search/types'
import {
  parsePdfDeepLink,
  parseRectTuple,
  parseSelectionTuple,
} from './selectionLink'

const DEEP_LINK_HIT_ID = 'foxycape-pdf-deeplink-hit'

const waitForTextLayer = async (
  renderer: IPdfRenderer,
  pageNumber: number,
  timeoutMs = 2500,
): Promise<HTMLElement | undefined> => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const pageEl = renderer.getPageView(pageNumber)?.div
    if (
      pageEl &&
      (pageEl.querySelector('svg.custom-text-layer text') ||
        pageEl.querySelector('.textLayer span'))
    ) {
      return pageEl
    }
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 40)
    })
  }
  return renderer.getPageView(pageNumber)?.div
}

const resolveItemElement = (
  pageEl: HTMLElement,
  itemIndex: number,
  pageNumber: number,
): Element | null => {
  return (
    pageEl.querySelector(`[data-text-index="${itemIndex}"]`) ||
    pageEl.querySelector(`[id$="-${pageNumber}-t-${itemIndex}"]`) ||
    (() => {
      const spans = Array.from(pageEl.querySelectorAll('.textLayer span')).filter((span) => {
        if (span.classList.contains('highlight') || span.classList.contains('appended')) {
          return false
        }
        return (span.textContent?.length ?? 0) > 0
      })
      return spans[itemIndex] ?? null
    })()
  )
}

const flashPageRects = async (
  renderer: IPdfRenderer,
  pageNumber: number,
  rects: PdfSearchMatch['rects'],
) => {
  if (!rects?.length) {
    return
  }
  renderer.setCurrentPage(pageNumber, true)
  await waitForPageRendered(renderer, pageNumber)
  const doc = renderer.getDocuments().find((d) => d.pageNumber === pageNumber)
  if (!doc) {
    return
  }
  const pageEl = doc.getContentContainer()
  if (!pageEl) {
    return
  }
  const root = renderer.getRendererContainer()
  removeAllSearchOverlays(root)
  const match: PdfSearchMatch = {
    id: DEEP_LINK_HIT_ID,
    index: 0,
    pageNumber,
    pageMatchIndex: 0,
    start: 0,
    length: 0,
    rects,
  }
  paintSearchHitOnPage(doc, match, rects, true)
  const hits = root
    ? Array.from(root.querySelectorAll(`[${MARK_HIGHLIGHT_ID_ATTR}="${DEEP_LINK_HIT_ID}"]`))
    : []
  hits[0]?.scrollIntoView({ block: 'center', inline: 'nearest' })
  playGotoHighlightAnimation(hits, { removeElements: true })
}

const paintSelectionFallback = async (
  renderer: IPdfRenderer,
  pageNumber: number,
  selection: string,
) => {
  const tuple = parseSelectionTuple(selection)
  if (!tuple) {
    return
  }
  const [beginIdx, beginOffset, endIdx, endOffset] = tuple
  renderer.setCurrentPage(pageNumber, true)
  await waitForPageRendered(renderer, pageNumber)
  // Selection tuple maps to text items; only this fallback still needs the text layer.
  const pageEl = await waitForTextLayer(renderer, pageNumber)
  if (!pageEl) {
    return
  }

  const texts: string[] = []
  const elements: Array<Element | null> = []
  for (let itemIndex = beginIdx; itemIndex <= endIdx; itemIndex++) {
    const el = resolveItemElement(pageEl, itemIndex, pageNumber)
    elements.push(el)
    texts.push(el?.textContent ?? '')
  }
  if (texts.length === 0) {
    return
  }

  const converted: PdfConvertedMatch = {
    begin: { divIdx: 0, offset: beginOffset },
    end: {
      divIdx: Math.max(0, texts.length - 1),
      offset: endOffset,
    },
  }
  const rects = measureConvertedMatchRects(pageEl, texts, elements, converted)
  if (rects.length === 0) {
    return
  }
  await flashPageRects(renderer, pageNumber, rects)
}

type PageViewForRect = {
  div?: HTMLElement
  viewport?: {
    convertToViewportRectangle?: (rect: number[]) => number[]
  }
  pdfPage?: {
    view?: number[]
  }
}

/** Map PDF user-space rect to CSS pixels relative to the page content box. */
const pdfUserSpaceRectToPageCss = (
  pageView: PageViewForRect | undefined,
  pageEl: HTMLElement,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): { x: number; y: number; width: number; height: number } | null => {
  const viewport = pageView?.viewport
  const convert = viewport?.convertToViewportRectangle
  if (typeof convert === 'function') {
    const converted: unknown = convert.call(viewport, [x1, y1, x2, y2])
    if (
      Array.isArray(converted) &&
      converted.length >= 4 &&
      typeof converted[0] === 'number' &&
      typeof converted[1] === 'number' &&
      typeof converted[2] === 'number' &&
      typeof converted[3] === 'number'
    ) {
      const vx1 = Math.min(converted[0], converted[2])
      const vy1 = Math.min(converted[1], converted[3])
      const vx2 = Math.max(converted[0], converted[2])
      const vy2 = Math.max(converted[1], converted[3])
      const width = vx2 - vx1
      const height = vy2 - vy1
      if (width > 0 && height > 0) {
        return { x: vx1, y: vy1, width, height }
      }
    }
  }

  // Fallback: same media-box origin assumption as image-dest / rect writers (view[2]/view[3]).
  const view = pageView?.pdfPage?.view
  const pageOriginWidth = view && view.length >= 4 ? view[2] : 0
  const pageOriginHeight = view && view.length >= 4 ? view[3] : 0
  const pageWidth = pageEl.clientWidth
  const pageHeight = pageEl.clientHeight
  if (
    !(pageOriginWidth > 0) ||
    !(pageOriginHeight > 0) ||
    !(pageWidth > 0) ||
    !(pageHeight > 0)
  ) {
    return null
  }
  const x = (x1 / pageOriginWidth) * pageWidth
  const y = ((pageOriginHeight - y2) / pageOriginHeight) * pageHeight
  const width = ((x2 - x1) / pageOriginWidth) * pageWidth
  const height = ((y2 - y1) / pageOriginHeight) * pageHeight
  if (!(width > 0) || !(height > 0)) {
    return null
  }
  return { x, y, width, height }
}

const paintRectHighlight = async (
  renderer: IPdfRenderer,
  pageNumber: number,
  rectParam: string,
) => {
  const tuple = parseRectTuple(rectParam)
  if (!tuple) {
    return
  }
  const [x1, y1, x2, y2] = tuple
  renderer.setCurrentPage(pageNumber, true)
  await waitForPageRendered(renderer, pageNumber)
  const doc = renderer.getDocuments().find((d) => d.pageNumber === pageNumber)
  const pageEl = doc?.getContentContainer()
  if (!pageEl) {
    return
  }
  const pageView = renderer.getPageView(pageNumber)
  const cssRect = pdfUserSpaceRectToPageCss(pageView, pageEl, x1, y1, x2, y2)
  if (!cssRect) {
    return
  }
  await flashPageRects(renderer, pageNumber, [cssRect])
}

/**
 * Navigate Foxycape PDF to a deep link: prefer markId, else page+selection, else page+rect.
 */
export const applyPdfDeepLink = async (options: {
  subpath: string
  renderer: IPdfRenderer | null | undefined
  getMarker: () => IMarker | undefined
}): Promise<void> => {
  const { page, selection, markId, rect } = parsePdfDeepLink(options.subpath)
  const marker = options.getMarker()
  const renderer = options.renderer

  if (markId && marker) {
    const mark = await marker.getMark(markId)
    if (mark) {
      await marker.goto(mark)
      return
    }
  }

  if (!renderer) {
    return
  }

  if (page != null && selection) {
    await paintSelectionFallback(renderer, page, selection)
    return
  }

  if (page != null && rect) {
    await paintRectHighlight(renderer, page, rect)
    return
  }

  if (page != null) {
    renderer.setCurrentPage(page, true)
  }
}
