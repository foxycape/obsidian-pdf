import type { IPdfRenderer } from '@foxycape/core/mediaTypes/pdf/renderer/IPdfRenderer'
import { getPageLayoutRef } from '@foxycape/core/mediaTypes/pdf/shared/geometry/selectionToFixedContentRange'
import {
  buildPdfXyzDestAtTextOffset,
  getPageText,
} from '@foxycape/core/mediaTypes/pdf/shared/text/pageText'
import { MARK_HIGHLIGHT_ID_ATTR } from '@/mark/MarkConstants'
import { rangeTextClientRects, removeOverlaysById } from '@/mark/overlay'
import { playGotoHighlightAnimation, waitForPageRendered } from '@/marker/PdfGotoAnimation'
import { paintSearchHitOnPage } from '@/search/PdfSearchOverlay'
import type { PdfSearchMatch, PdfSearchRect } from '@/search/types'
import { parseTextOffsetTuple } from './selectionLink'

const PAGE_TEXT_HIT_ID = 'foxycape-pdf-page-text-hit'

type PdfViewerScroll = {
  scrollPageIntoView: (params: {
    pageNumber: number
    destArray: unknown[]
    allowNegativeOffset?: boolean
    ignoreDestinationZoom?: boolean
  }) => void
}

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

const scrollToPdfDest = (renderer: IPdfRenderer, pageNumber: number, dest: string): boolean => {
  try {
    const viewer = (renderer as { getPdfViewer?: () => PdfViewerScroll }).getPdfViewer?.()
    if (!viewer) {
      return false
    }
    viewer.scrollPageIntoView({
      pageNumber,
      destArray: JSON.parse(dest) as unknown[],
      allowNegativeOffset: true,
      ignoreDestinationZoom: true,
    })
    return true
  } catch {
    return false
  }
}

const mapCharOffsetToTextPosition = (
  root: Node,
  charOffset: number,
): { node: Text; offset: number } | null => {
  if (charOffset < 0) {
    return null
  }
  const walker = root.ownerDocument?.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  if (!walker) {
    return null
  }
  let accumulated = 0
  let lastText: Text | null = null
  let current: Text | null
  while ((current = walker.nextNode() as Text | null)) {
    lastText = current
    const length = (current.textContent ?? '').length
    if (charOffset < accumulated + length) {
      return { node: current, offset: charOffset - accumulated }
    }
    accumulated += length
  }
  if (lastText) {
    return { node: lastText, offset: (lastText.textContent ?? '').length }
  }
  return null
}

const charOffsetsToRange = (root: Element, start: number, length: number): Range | null => {
  const ownerDocument = root.ownerDocument
  if (!ownerDocument) {
    return null
  }
  const startPos = mapCharOffsetToTextPosition(root, start)
  const endPos = mapCharOffsetToTextPosition(root, start + Math.max(0, length))
  if (!startPos || !endPos) {
    return null
  }
  const range = ownerDocument.createRange()
  try {
    range.setStart(startPos.node, startPos.offset)
    range.setEnd(endPos.node, endPos.offset)
  } catch {
    return null
  }
  return range
}

const collapseWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim()

const closestIndexOf = (haystack: string, needle: string, hint: number) => {
  let closest = haystack.indexOf(needle)
  if (closest < 0) {
    return -1
  }
  let next = closest
  while (next >= 0) {
    if (Math.abs(next - hint) < Math.abs(closest - hint)) {
      closest = next
    }
    next = haystack.indexOf(needle, next + 1)
  }
  return closest
}

const findCollapsedSnippet = (
  liveText: string,
  snippet: string,
  hint = 0,
): { start: number; length: number } | undefined => {
  const needle = collapseWhitespace(snippet)
  if (!needle || !liveText) {
    return undefined
  }
  const exact = closestIndexOf(liveText, needle, hint)
  if (exact >= 0) {
    return { start: exact, length: needle.length }
  }
  const map: number[] = []
  let collapsed = ''
  for (let index = 0; index < liveText.length; index += 1) {
    const ch = liveText[index] ?? ''
    if (/\s/.test(ch)) {
      if (collapsed.endsWith(' ')) {
        continue
      }
      map.push(index)
      collapsed += ' '
    } else {
      map.push(index)
      collapsed += ch
    }
  }
  const collapsedHint = map.reduce((best, liveIndex, collapsedIndex) => {
    const bestLive = map[best] ?? 0
    return Math.abs(liveIndex - hint) < Math.abs(bestLive - hint) ? collapsedIndex : best
  }, 0)
  const collapsedStart = closestIndexOf(collapsed, needle, collapsedHint)
  if (collapsedStart < 0) {
    return undefined
  }
  const startLive = map[collapsedStart]
  const endLive = map[collapsedStart + needle.length - 1]
  if (startLive == null || endLive == null) {
    return undefined
  }
  return { start: startLive, length: endLive - startLive + 1 }
}

const alignSnippet = (liveText: string, start: number, needle: string) => {
  if (liveText.slice(start, start + needle.length) === needle) {
    return { start, length: needle.length }
  }
  return findCollapsedSnippet(liveText, needle, start)
}

const pageRelativeRects = (
  pageEl: HTMLElement,
  clientRects: ArrayLike<DOMRect>,
): PdfSearchRect[] => {
  const layout = getPageLayoutRef(pageEl)
  if (!layout) {
    return []
  }
  const rects: PdfSearchRect[] = []
  for (let index = 0; index < clientRects.length; index += 1) {
    const rect = clientRects[index]
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      continue
    }
    rects.push({
      x: rect.left - layout.contentLeft,
      y: rect.top - layout.contentTop,
      width: rect.width,
      height: rect.height,
    })
  }
  return rects
}

const paintLiveSnippet = async (
  renderer: IPdfRenderer,
  pageNumber: number,
  start: number,
  needle: string,
): Promise<boolean> => {
  await waitForPageRendered(renderer, pageNumber)
  const pageEl = await waitForTextLayer(renderer, pageNumber)
  if (!pageEl || !needle.trim()) {
    return false
  }
  const liveText = pageEl.textContent ?? ''
  const aligned = alignSnippet(liveText, start, needle)
  if (!aligned) {
    return false
  }
  const range = charOffsetsToRange(pageEl, aligned.start, aligned.length)
  if (!range || range.collapsed) {
    return false
  }
  const rects = pageRelativeRects(pageEl, rangeTextClientRects(range))
  const doc = renderer.getDocuments().find((item) => item.pageNumber === pageNumber)
  const root = renderer.getRendererContainer()
  if (!doc || !root || rects.length === 0) {
    return false
  }
  removeOverlaysById(root, [PAGE_TEXT_HIT_ID], MARK_HIGHLIGHT_ID_ATTR)
  const match: PdfSearchMatch = {
    id: PAGE_TEXT_HIT_ID,
    index: 0,
    pageNumber,
    pageMatchIndex: 0,
    start: aligned.start,
    length: aligned.length,
    rects,
  }
  paintSearchHitOnPage(doc, match, rects, true)
  const hits = Array.from(
    root.querySelectorAll(`[${MARK_HIGHLIGHT_ID_ATTR}="${PAGE_TEXT_HIT_ID}"]`),
  )
  hits[0]?.scrollIntoView({ block: 'center', inline: 'nearest' })
  playGotoHighlightAnimation(hits, { removeElements: true })
  return hits.length > 0
}

/**
 * Scroll to the text item at a page-plaintext offset, then align the highlight
 * to the passage. Returns false when neither the text item nor the passage is found.
 */
export const highlightPdfPageTextOffset = async (
  renderer: IPdfRenderer,
  pageNumber: number,
  textOffset: string,
  snippet?: string,
): Promise<boolean> => {
  const tuple = parseTextOffsetTuple(textOffset)
  if (!tuple || pageNumber < 1) {
    return false
  }
  const [start, end] = tuple
  const page = await renderer.getPdfPage(pageNumber)
  if (!page) {
    renderer.setCurrentPage(pageNumber, true)
    return false
  }
  const pageText = await getPageText(page)
  const from = Math.max(0, Math.min(start, pageText.length))
  const to = Math.max(from, Math.min(end, pageText.length))
  const sliced = pageText.slice(from, to)
  const needle = snippet?.trim() || sliced.trim()
  const dest = await buildPdfXyzDestAtTextOffset(page, from, needle || undefined)
  const scrolled = dest ? scrollToPdfDest(renderer, pageNumber, dest) : false
  if (!scrolled) {
    renderer.setCurrentPage(pageNumber, true)
  }
  if (!needle) {
    return scrolled
  }
  const painted = await paintLiveSnippet(renderer, pageNumber, from, needle)
  return scrolled || painted
}
