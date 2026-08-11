import type { IPdfDocument } from '@foxycape/core/mediaTypes/pdf/renderer/IPdfDocument'
import type { PdfSearchMatch, PdfSearchRect } from './types'

export const PDF_SEARCH_LAYER_CLASS = 'foxycape-pdf-search-layer'
export const PDF_SEARCH_HIT_CLASS = 'foxycape-pdf-search-hit'
export const PDF_SEARCH_HIT_ACTIVE_CLASS = 'foxycape-pdf-search-hit-active'
export const PDF_SEARCH_HIT_ID_ATTR = 'data-search-hit-id'

const ensureSearchLayer = (pageEl: HTMLElement): HTMLElement => {
  let layer = pageEl.querySelector<HTMLElement>(`:scope > .${PDF_SEARCH_LAYER_CLASS}`)
  if (!layer) {
    layer = pageEl.createDiv({ cls: PDF_SEARCH_LAYER_CLASS })
    const style = pageEl.ownerDocument.defaultView?.getComputedStyle(pageEl)
    if (style && style.position === 'static') {
      pageEl.classList.add('foxycape-pdf-page--relative')
    }
  }
  // left/top come from .foxycape-pdf-search-layer CSS; only size is dynamic.
  layer.setCssStyles({
    width: `${pageEl.clientWidth}px`,
    height: `${pageEl.clientHeight}px`,
  })
  return layer
}

const removeHitFromPage = (pageEl: HTMLElement, hitId: string) => {
  pageEl
    .querySelectorAll(`[${PDF_SEARCH_HIT_ID_ATTR}="${CSS.escape(hitId)}"]`)
    .forEach((node) => node.remove())
}

export const removeAllSearchOverlays = (root: ParentNode) => {
  root.querySelectorAll(`.${PDF_SEARCH_LAYER_CLASS}`).forEach((layer) => layer.remove())
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
  removeHitFromPage(pageEl, match.id)
  const layer = ensureSearchLayer(pageEl)
  for (const rect of rects) {
    if (rect.width <= 0 || rect.height <= 0) {
      continue
    }
    const mask = layer.createDiv({
      cls: isActive
        ? `${PDF_SEARCH_HIT_CLASS} ${PDF_SEARCH_HIT_ACTIVE_CLASS}`
        : PDF_SEARCH_HIT_CLASS,
    })
    mask.setAttribute(PDF_SEARCH_HIT_ID_ATTR, match.id)
    mask.setAttribute(
      'style',
      `left:${rect.x}px;top:${rect.y}px;width:${rect.width}px;height:${rect.height}px;`,
    )
  }
}

export const setSearchHitActive = (
  root: ParentNode,
  hitId: string,
  scrollIntoView?: (el: Element) => void,
) => {
  clearActiveSearchHits(root)
  const nodes = root.querySelectorAll(`[${PDF_SEARCH_HIT_ID_ATTR}="${CSS.escape(hitId)}"]`)
  nodes.forEach((node) => node.classList.add(PDF_SEARCH_HIT_ACTIVE_CLASS))
  const first = nodes[0]
  if (first && scrollIntoView) {
    scrollIntoView(first)
  }
}
