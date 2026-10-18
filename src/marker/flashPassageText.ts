import type { IPdfRenderer } from '@foxycape/core/mediaTypes/pdf/renderer/IPdfRenderer'
import { MARK_HIGHLIGHT_ID_ATTR } from '@/mark/MarkConstants'
import { removeOverlaysById } from '@/mark/overlay'
import { playGotoHighlightAnimation, waitForPageRendered } from '@/marker/PdfGotoAnimation'
import {
  buildTextLayerMapping,
  collectPageTextElements,
  convertMatches,
  measureConvertedMatchRects,
} from '@/search/matchGeometry'
import { paintSearchHitOnPage } from '@/search/PdfSearchOverlay'
import type { PdfSearchMatch, PdfSearchRect } from '@/search/types'

const PASSAGE_FLASH_ID = 'foxycape-pdf-passage-text'

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
      (pageEl.querySelector('svg.custom-text-layer text') || pageEl.querySelector('.textLayer span'))
    ) {
      return pageEl
    }
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 40)
    })
  }
  return renderer.getPageView(pageNumber)?.div
}

const compactIndex = (haystack: string, needle: string) => {
  const compactNeedle = needle.replace(/\s+/g, '').toLowerCase()
  if (!compactNeedle) {
    return undefined
  }
  let compact = ''
  const origins: number[] = []
  for (let index = 0; index < haystack.length; index++) {
    if (/\s/.test(haystack[index] ?? '')) {
      continue
    }
    compact += haystack[index]?.toLowerCase() ?? ''
    origins.push(index)
  }
  const found = compact.indexOf(compactNeedle)
  if (found < 0) {
    return undefined
  }
  const start = origins[found]
  const end = (origins[found + compactNeedle.length - 1] ?? start) + 1
  if (start == null || end <= start) {
    return undefined
  }
  return { start, length: end - start }
}

const findRectsOnPage = async (
  renderer: IPdfRenderer,
  pageNumber: number,
  text: string,
): Promise<PdfSearchRect[]> => {
  const needle = text.trim()
  if (!needle) {
    return []
  }
  renderer.setCurrentPage(pageNumber, true)
  await waitForPageRendered(renderer, pageNumber)
  const pageEl = await waitForTextLayer(renderer, pageNumber)
  const pageView = renderer.getPageView(pageNumber)
  const pdfPage = pageView?.pdfPage
  if (!pageEl || !pdfPage) {
    return []
  }
  const textContent = await pdfPage.getTextContent({ disableNormalization: true })
  const mapping = buildTextLayerMapping(textContent.items)
  const located = compactIndex(mapping.texts.join(''), needle)
  if (!located) {
    return []
  }
  const converted = convertMatches([located.start], [located.length], mapping.texts)[0]
  if (!converted) {
    return []
  }
  const { texts, elements } = collectPageTextElements(pageEl, mapping, pageNumber, pageView)
  return measureConvertedMatchRects(pageEl, texts, elements, converted)
}

const flashRects = async (
  renderer: IPdfRenderer,
  pageNumber: number,
  rects: PdfSearchRect[],
) => {
  const doc = renderer.getDocuments().find((item) => item.pageNumber === pageNumber)
  const pageEl = doc?.getContentContainer()
  const root = renderer.getRendererContainer()
  if (!doc || !pageEl || !root || rects.length === 0) {
    return false
  }
  removeOverlaysById(root, [PASSAGE_FLASH_ID], MARK_HIGHLIGHT_ID_ATTR)
  const match: PdfSearchMatch = {
    id: PASSAGE_FLASH_ID,
    index: 0,
    pageNumber,
    pageMatchIndex: 0,
    start: 0,
    length: 0,
    rects,
  }
  paintSearchHitOnPage(doc, match, rects, true)
  const hits = Array.from(root.querySelectorAll(`[${MARK_HIGHLIGHT_ID_ATTR}="${PASSAGE_FLASH_ID}"]`))
  hits[0]?.scrollIntoView({ block: 'center', inline: 'nearest' })
  playGotoHighlightAnimation(hits, { removeElements: true })
  return hits.length > 0
}

/** Find stored source text on the page (then neighbors) and flash it. */
export const flashPassageText = async (
  renderer: IPdfRenderer | null | undefined,
  pageNumber: number | undefined,
  text: string,
): Promise<boolean> => {
  if (!renderer || !pageNumber || pageNumber < 1 || !text.trim()) {
    return false
  }
  const pages = [pageNumber, pageNumber - 1, pageNumber + 1].filter((page) => page >= 1)
  for (const page of pages) {
    const rects = await findRectsOnPage(renderer, page, text)
    if (rects.length > 0 && (await flashRects(renderer, page, rects))) {
      return true
    }
  }
  return false
}
