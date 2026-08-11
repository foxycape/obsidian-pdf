import type { IPdfDocument } from '@foxycape/core/mediaTypes/pdf/renderer/IPdfDocument'
import type { PdfSearchMatch, PdfSearchRect } from './types'

export const PDF_SEARCH_LAYER_CLASS = 'foxycape-pdf-search-layer'
export const PDF_SEARCH_HIT_CLASS = 'foxycape-pdf-search-hit'
export const PDF_SEARCH_HIT_ACTIVE_CLASS = 'foxycape-pdf-search-hit-active'
export const PDF_SEARCH_HIT_ID_ATTR = 'data-search-hit-id'
export const PDF_SEARCH_STYLE_ELEMENT_ID = 'foxycape-pdf-search-styles'

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

export const injectSearchHighlightStyles = (doc: Document, replace = false) => {
  const existing = doc.getElementById(PDF_SEARCH_STYLE_ELEMENT_ID)
  if (existing && !replace) {
    return
  }
  const css = `
.${PDF_SEARCH_LAYER_CLASS}{
  position:absolute;
  left:0;top:0;
  pointer-events:none;
  z-index:3;
}
.${PDF_SEARCH_HIT_CLASS}{
  position:absolute;
  background:rgba(255, 212, 0, 0.45);
  border-radius:2px;
  mix-blend-mode:multiply;
}
.${PDF_SEARCH_HIT_ACTIVE_CLASS}{
  background:rgba(255, 140, 0, 0.65);
}
`
  if (existing) {
    existing.textContent = css
    return
  }
  const style = doc.head.createEl('style')
  style.id = PDF_SEARCH_STYLE_ELEMENT_ID
  style.textContent = css
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
  injectSearchHighlightStyles(pageEl.ownerDocument)
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
