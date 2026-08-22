import type { ContentGeometry } from '@foxycape/core/kernal/ContentRange'
import {
  MARK_HIGHLIGHT_ID_ATTR,
  MARK_STYLE_ATTR,
  MARK_TYPE_ATTR,
} from '@foxycape/core/kernal/mark/MarkConstants'
import { getFixedContentRange, type Mark } from '@foxycape/core/kernal/mark/Mark'
import {
  ensureOverlayLayer,
  findOverlayIdAtPoint,
  paintRects,
  removeOverlayLayers,
  removeOverlaysById,
} from '@foxycape/core/kernal/mark/overlay'
import { scaleGeometryCoords } from '@foxycape/core/mediaTypes/pdf/shared/geometry/selectionToFixedContentRange'
import {
  PDF_MARK_LAYER_CLASS,
  PDF_MARK_MASK_CLASS,
  PDF_PAGE_RELATIVE_CLASS,
} from '@foxycape/core/mediaTypes/pdf/highlighter/PdfHighlightConstants'
import {
  getCustomColorStyleText,
  resolveMarkStyleType,
  resolveWritingMode,
} from '@foxycape/core/mediaTypes/pdf/highlighter/pdfHighlightStyles'
import type { IPdfDocument } from '@foxycape/core/mediaTypes/pdf/renderer/IPdfDocument'

const ensureMarkLayer = (pageEl: HTMLElement): HTMLElement =>
  ensureOverlayLayer(pageEl, PDF_MARK_LAYER_CLASS, {
    relativeClass: PDF_PAGE_RELATIVE_CLASS,
  })

export const removeMarkOverlays = (root: ParentNode, markIds: string[]) => {
  removeOverlaysById(root, markIds, MARK_HIGHLIGHT_ID_ATTR)
}

export const removeAllMarkOverlays = (root: ParentNode) => {
  removeOverlayLayers(root, PDF_MARK_LAYER_CLASS)
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
  const className = [
    mark.styleName,
    PDF_MARK_MASK_CLASS,
    writingMode !== 'horizontal-tb' ? styleType : '',
  ]
    .filter(Boolean)
    .join(' ')
  paintRects(layer, [scaled], {
    id: mark.markId,
    className,
    idAttr: MARK_HIGHLIGHT_ID_ATTR,
    attrs: {
      [MARK_TYPE_ATTR]: mark.type,
      [MARK_STYLE_ATTR]: mark.styleName,
    },
    extraStyle: getCustomColorStyleText(styleType, mark.customColor),
    replace: false,
  })
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

  removeOverlaysById(pageEl, [mark.markId], MARK_HIGHLIGHT_ID_ATTR)
  const layer = ensureMarkLayer(pageEl)
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
): string | undefined =>
  findOverlayIdAtPoint(pageEl, PDF_MARK_MASK_CLASS, offsetX, offsetY, MARK_HIGHLIGHT_ID_ATTR)
