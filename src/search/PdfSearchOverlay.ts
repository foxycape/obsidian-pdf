import {
  MARK_HIGHLIGHT_ID_ATTR,
  MARK_TYPE_ATTR,
} from '@foxycape/core/kernal/mark/MarkConstants'
import {
  ensureOverlayLayer,
  paintRects,
  removeOverlayLayers,
} from '@foxycape/core/kernal/mark/overlay'
import {
  PDF_PAGE_RELATIVE_CLASS,
  PDF_SEARCH_HIT_ACTIVE_CLASS,
  PDF_SEARCH_HIT_CLASS,
  PDF_SEARCH_LAYER_CLASS,
} from '@foxycape/core/mediaTypes/pdf/highlighter/PdfHighlightConstants'
import type { IPdfDocument } from '@foxycape/core/mediaTypes/pdf/renderer/IPdfDocument'
import type { PdfSearchMatch, PdfSearchRect } from './types'

export {
  PDF_SEARCH_HIT_ACTIVE_CLASS,
  PDF_SEARCH_HIT_CLASS,
  PDF_SEARCH_LAYER_CLASS,
}

/** @deprecated Use MARK_HIGHLIGHT_ID_ATTR; kept for existing query selectors. */
export const PDF_SEARCH_HIT_ID_ATTR = MARK_HIGHLIGHT_ID_ATTR

const ensureSearchLayer = (pageEl: HTMLElement): HTMLElement =>
  ensureOverlayLayer(pageEl, PDF_SEARCH_LAYER_CLASS, {
    relativeClass: PDF_PAGE_RELATIVE_CLASS,
  })

export const removeAllSearchOverlays = (root: ParentNode) => {
  removeOverlayLayers(root, PDF_SEARCH_LAYER_CLASS)
}

export const clearActiveSearchHits = (root: ParentNode) => {
  root.querySelectorAll(`.${PDF_SEARCH_HIT_ACTIVE_CLASS}`).forEach((node) => {
    node.classList.remove(PDF_SEARCH_HIT_ACTIVE_CLASS)
  })
}

export const paintSearchHitOnPage = (
  doc: IPdfDocument,
  match: PdfSearchMatch,
  rects: PdfSearchRect[],
  isActive: boolean,
) => {
  const pageEl = doc.getContentContainer()
  if (!pageEl || rects.length === 0) {
    return
  }
  const layer = ensureSearchLayer(pageEl)
  paintRects(layer, rects, {
    id: match.id,
    className: isActive
      ? `${PDF_SEARCH_HIT_CLASS} ${PDF_SEARCH_HIT_ACTIVE_CLASS}`
      : PDF_SEARCH_HIT_CLASS,
    idAttr: MARK_HIGHLIGHT_ID_ATTR,
    attrs: {
      [MARK_TYPE_ATTR]: 'search',
    },
  })
}

export const setSearchHitActive = (
  root: ParentNode,
  hitId: string,
  scrollIntoView?: (el: Element) => void,
) => {
  clearActiveSearchHits(root)
  const nodes = root.querySelectorAll(`[${MARK_HIGHLIGHT_ID_ATTR}="${CSS.escape(hitId)}"]`)
  nodes.forEach((node) => node.classList.add(PDF_SEARCH_HIT_ACTIVE_CLASS))
  const first = nodes[0]
  if (first && scrollIntoView) {
    scrollIntoView(first)
  }
}
