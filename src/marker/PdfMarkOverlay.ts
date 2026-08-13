import type { ContentGeometry } from '@foxycape/core/kernal/ContentRange'
import {
  MARK_HIGHLIGHT_ID_ATTR,
  MARK_STYLE_ATTR,
  MARK_TYPE_ATTR,
} from '@foxycape/core/kernal/mark/MarkConstants'
import { getFixedContentRange, type Mark } from '@foxycape/core/kernal/mark/Mark'
import { scaleGeometryCoords } from '@foxycape/core/mediaTypes/pdf/shared/geometry/selectionToFixedContentRange'
import type { IPdfDocument } from '@foxycape/core/mediaTypes/pdf/renderer/IPdfDocument'
import { PDF_MARK_LAYER_CLASS, PDF_MARK_MASK_CLASS } from './PdfMarkConstants'
import {
  getCustomColorStyleText,
  resolveMarkStyleType,
  type MarkWritingMode,
} from './PdfMarkStyles'

type InkEdge = 'bottom' | 'left' | 'top' | 'right'

const INK_EDGES_CW: InkEdge[] = ['bottom', 'left', 'top', 'right']

/** Stored rect aspect: wide → underline bottom; tall → underline right (vertical-lr). */
const resolveInkEdge = (width: number, height: number): InkEdge =>
  width > height ? 'bottom' : 'right'

const rotateInkEdge = (edge: InkEdge, rotationDelta: number): InkEdge => {
  const steps = ((Math.round(rotationDelta / 90) % 4) + 4) % 4
  const index = INK_EDGES_CW.indexOf(edge)
  return INK_EDGES_CW[(index + steps) % 4] ?? edge
}

const inkEdgeToWritingMode = (edge: InkEdge): MarkWritingMode => {
  if (edge === 'left') {
    return 'vertical-rl'
  }
  if (edge === 'right') {
    return 'vertical-lr'
  }
  if (edge === 'top') {
    return 'horizontal-bt'
  }
  return 'horizontal-tb'
}

/** Writing mode follows stored glyph side, then rotates with the page. */
const resolveWritingMode = (
  storedWidth: number,
  storedHeight: number,
  rotationDelta: number,
): MarkWritingMode => inkEdgeToWritingMode(rotateInkEdge(resolveInkEdge(storedWidth, storedHeight), rotationDelta))

const ensureMarkLayer = (pageEl: HTMLElement): HTMLElement => {
  let layer = pageEl.querySelector<HTMLElement>(`:scope > .${PDF_MARK_LAYER_CLASS}`)
  if (!layer) {
    layer = pageEl.createDiv({ cls: PDF_MARK_LAYER_CLASS })
    const style = pageEl.ownerDocument.defaultView?.getComputedStyle(pageEl)
    if (style && style.position === 'static') {
      pageEl.classList.add('foxycape-pdf-page--relative')
    }
  }
  // Absolute children are positioned against the padding edge (already inside border).
  // Do NOT offset by clientLeft/clientTop again — that double-counts the page border
  // and shifts marks down/right by ~9px.
  // left/top come from .foxycape-pdf-mark-layer CSS; only size is dynamic.
  layer.setCssStyles({
    width: `${pageEl.clientWidth}px`,
    height: `${pageEl.clientHeight}px`,
  })
  return layer
}

const removeMarkFromPage = (pageEl: HTMLElement, markId: string) => {
  const layer = pageEl.querySelector(`:scope > .${PDF_MARK_LAYER_CLASS}`)
  if (!layer) {
    return
  }
  layer
    .querySelectorAll(`[${MARK_HIGHLIGHT_ID_ATTR}="${CSS.escape(markId)}"]`)
    .forEach((node) => node.remove())
}

export const removeMarkOverlays = (root: ParentNode, markIds: string[]) => {
  for (const markId of markIds) {
    root
      .querySelectorAll(`[${MARK_HIGHLIGHT_ID_ATTR}="${CSS.escape(markId)}"]`)
      .forEach((node) => node.remove())
  }
}

export const removeAllMarkOverlays = (root: ParentNode) => {
  root.querySelectorAll(`.${PDF_MARK_LAYER_CLASS}`).forEach((layer) => layer.remove())
}

const paintGeometry = (
  layer: HTMLElement,
  mark: Mark,
  geometry: ContentGeometry,
  displayWidth: number,
  displayHeight: number,
  currentRotation: number,
) => {
  const scaled = scaleGeometryCoords(geometry, displayWidth, displayHeight, currentRotation)
  if (scaled.width <= 0 || scaled.height <= 0) {
    return
  }
  const [, , storedW = 0, storedH = 0] = geometry.coords
  const writingMode = resolveWritingMode(storedW, storedH, scaled.rotationDelta)
  const styleType = resolveMarkStyleType(mark.styleName, writingMode)
  const mask = layer.createDiv({ cls: `${mark.styleName} ${PDF_MARK_MASK_CLASS}` })
  if (writingMode !== 'horizontal-tb') {
    mask.classList.add(styleType)
  }
  mask.setAttribute(MARK_HIGHLIGHT_ID_ATTR, mark.markId)
  mask.setAttribute(MARK_TYPE_ATTR, mark.type)
  mask.setAttribute(MARK_STYLE_ATTR, mark.styleName)
  const custom = getCustomColorStyleText(styleType, mark.customColor)
  mask.setAttribute(
    'style',
    `${custom}left:${scaled.x}px;top:${scaled.y}px;width:${scaled.width}px;height:${scaled.height}px;`,
  )
}

/**
 * Draw mark overlays for geometries that belong to the given page.
 */
export const paintMarkOnPage = (doc: IPdfDocument, mark: Mark) => {
  const pageEl = doc.getContentContainer()
  if (!pageEl) {
    return
  }
  const pageGeometry = doc.getPageGeometry()
  if (!pageGeometry) {
    return
  }
  const fixed = getFixedContentRange(mark)
  if (!fixed) {
    return
  }
  const pageNumber = doc.pageNumber
  const geometries = fixed.geometries.filter((g) => g.pageNumber === pageNumber)
  if (geometries.length === 0) {
    return
  }

  removeMarkFromPage(pageEl, mark.markId)
  const layer = ensureMarkLayer(pageEl)
  // Prefer content-box size so restore matches selection coords (excludes page border).
  const displayWidth = pageEl.clientWidth || pageGeometry.displayWidth || pageGeometry.pageRect.width
  const displayHeight =
    pageEl.clientHeight || pageGeometry.displayHeight || pageGeometry.pageRect.height
  const currentRotation = pageGeometry.rotation ?? 0
  for (const geometry of geometries) {
    paintGeometry(layer, mark, geometry, displayWidth, displayHeight, currentRotation)
  }
}

export const findMarkIdAtPoint = (
  pageEl: HTMLElement,
  offsetX: number,
  offsetY: number,
): string | undefined => {
  const masks = pageEl.querySelectorAll<HTMLElement>(`.${PDF_MARK_MASK_CLASS}`)
  for (const mask of Array.from(masks)) {
    const left = Number.parseFloat(mask.style.left)
    const top = Number.parseFloat(mask.style.top)
    const width = Number.parseFloat(mask.style.width)
    const height = Number.parseFloat(mask.style.height)
    if (
      offsetX >= left &&
      offsetX <= left + width &&
      offsetY >= top &&
      offsetY <= top + height
    ) {
      return mask.getAttribute(MARK_HIGHLIGHT_ID_ATTR) ?? undefined
    }
  }
  return undefined
}
