import {
  isFixedContentRange,
  type ContentGeometry,
  type ContentRange,
  type FixedContentRange,
} from '@foxycape/core/kernal/ContentRange'
import type {
  HighlightItem,
  HighlightRelayoutScope,
  IHighlighter,
} from '@foxycape/core/kernal/mark/IHighlighter'
import {
  MARK_HIGHLIGHT_ID_ATTR,
  MARK_STYLE_ATTR,
  MARK_TYPE_ATTR,
} from '@foxycape/core/kernal/mark/MarkConstants'
import type { FindMarkTarget } from '@foxycape/core/kernal/mark/types'
import {
  ensureOverlayLayer,
  findOverlayIdAtPoint,
  paintRects,
  removeOverlaysById,
  type OverlayRect,
} from '@foxycape/core/kernal/mark/overlay'
import {
  PDF_MARK_LAYER_CLASS,
  PDF_MARK_MASK_CLASS,
  PDF_PAGE_RELATIVE_CLASS,
  PDF_SEARCH_HIT_ACTIVE_CLASS,
  PDF_SEARCH_HIT_CLASS,
  PDF_SEARCH_LAYER_CLASS,
} from '@foxycape/core/mediaTypes/pdf/highlighter/PdfHighlightConstants'
import {
  getCustomColorStyleText,
  resolveMarkStyleType,
  resolveWritingMode,
} from '@foxycape/core/mediaTypes/pdf/highlighter/pdfHighlightStyles'
import type { IPdfDocument } from '@foxycape/core/mediaTypes/pdf/renderer/IPdfDocument'
import type { IPdfRenderer } from '@foxycape/core/mediaTypes/pdf/renderer/IPdfRenderer'
import { scaleGeometryCoords } from '@foxycape/core/mediaTypes/pdf/shared/geometry/selectionToFixedContentRange'

const SEARCH_TYPE = 'search'

const toFixedRange = (range?: ContentRange): FixedContentRange | undefined => {
  if (!range) {
    return undefined
  }
  if (isFixedContentRange(range)) {
    return range
  }
  const geometries = (range as { geometries?: FixedContentRange['geometries'] }).geometries
  if (Array.isArray(geometries) && geometries.length > 0) {
    return { kind: 'fixed', geometries }
  }
  return undefined
}

const itemMatchesPage = (item: HighlightItem, pageNumber: number): boolean => {
  if (item.pageNumber === pageNumber) {
    return true
  }
  return toFixedRange(item.contentRange)?.geometries.some((g) => g.pageNumber === pageNumber) ?? false
}

const shouldPaintRects = (item: HighlightItem): boolean =>
  !!item.rects?.length && (item.type === SEARCH_TYPE || !item.contentRange)

export class PdfHighlighter implements IHighlighter {
  private readonly items = new Map<string, HighlightItem>()

  constructor(private readonly renderer: IPdfRenderer) {}

  paint(items: HighlightItem[]): void {
    for (const item of items) {
      this.items.set(item.id, item)
      this.paintItem(item)
    }
  }

  remove(ids: string[]): void {
    const root = this.renderer.getRendererContainer()
    if (root) {
      removeOverlaysById(root, ids, MARK_HIGHLIGHT_ID_ATTR)
    }
    for (const id of ids) {
      this.items.delete(id)
    }
  }

  removeByType(types: string[]): void {
    const ids = Array.from(this.items.values())
      .filter((item) => types.includes(item.type))
      .map((item) => item.id)
    this.remove(ids)
  }

  removeAll(): void {
    const root = this.renderer.getRendererContainer()
    if (root) {
      removeOverlaysById(root, Array.from(this.items.keys()), MARK_HIGHLIGHT_ID_ATTR)
    }
    this.items.clear()
  }

  getElements(id: string): Element[] {
    const root = this.renderer.getRendererContainer()
    if (!root || !id) {
      return []
    }
    return Array.from(root.querySelectorAll(`[${MARK_HIGHLIGHT_ID_ATTR}="${CSS.escape(id)}"]`))
  }

  findAt(target: FindMarkTarget): { id: string; type: string } | undefined {
    if (target.element) {
      const host = target.element.closest<HTMLElement>(`[${MARK_HIGHLIGHT_ID_ATTR}]`)
      if (host) {
        const id = host.getAttribute(MARK_HIGHLIGHT_ID_ATTR)
        const item = id ? this.items.get(id) : undefined
        if (item) {
          return { id: item.id, type: item.type }
        }
      }
    }
    const pageNumber = target.pageNumber
    if (pageNumber == null || target.offsetX == null || target.offsetY == null) {
      return undefined
    }
    const pageEl = this.getDocByPageNumber(pageNumber)?.getContentContainer()
    if (!pageEl) {
      return undefined
    }
    const id = findOverlayIdAtPoint(
      pageEl,
      PDF_MARK_MASK_CLASS,
      target.offsetX,
      target.offsetY,
      MARK_HIGHLIGHT_ID_ATTR,
    )
    const item = id ? this.items.get(id) : undefined
    if (!item) {
      return undefined
    }
    return { id: item.id, type: item.type }
  }

  relayout(scope?: HighlightRelayoutScope): void {
    for (const item of this.items.values()) {
      if (scope?.pageNumber != null && !itemMatchesPage(item, scope.pageNumber)) {
        continue
      }
      this.paintItem(item)
    }
  }

  async dispose(): Promise<void> {
    this.removeAll()
  }

  private paintItem = (item: HighlightItem) => {
    if (shouldPaintRects(item)) {
      this.paintSearchItem(item)
      return
    }
    this.paintMarkItem(item)
  }

  private paintMarkItem = (item: HighlightItem) => {
    const fixed = toFixedRange(item.contentRange)
    if (!fixed) {
      return
    }
    const pageNumbers = new Set(fixed.geometries.map((g) => g.pageNumber))
    for (const pageNumber of pageNumbers) {
      const doc = this.getDocByPageNumber(pageNumber)
      if (!doc) {
        continue
      }
      this.paintMarkOnPage(
        doc,
        item,
        fixed.geometries.filter((g) => g.pageNumber === pageNumber),
      )
    }
  }

  private paintMarkOnPage = (
    doc: IPdfDocument,
    item: HighlightItem,
    geometries: ContentGeometry[],
  ) => {
    const pageEl = doc.getContentContainer()
    if (!pageEl || geometries.length === 0) {
      return
    }
    const pageGeometry = doc.getPageGeometry()
    if (!pageGeometry) {
      return
    }
    removeOverlaysById(pageEl, [item.id], MARK_HIGHLIGHT_ID_ATTR)
    const layer = ensureOverlayLayer(pageEl, PDF_MARK_LAYER_CLASS, {
      relativeClass: PDF_PAGE_RELATIVE_CLASS,
    })
    const displayWidth = pageEl.clientWidth || pageGeometry.displayWidth || pageGeometry.pageRect.width
    const displayHeight =
      pageEl.clientHeight || pageGeometry.displayHeight || pageGeometry.pageRect.height
    const currentRotation = pageGeometry.rotation ?? 0
    for (const geometry of geometries) {
      const scaled = scaleGeometryCoords(geometry, displayWidth, displayHeight, currentRotation)
      if (scaled.width <= 0 || scaled.height <= 0) {
        continue
      }
      const [, , storedW = 0, storedH = 0] = geometry.coords
      const writingMode = resolveWritingMode(storedW, storedH, scaled.rotationDelta)
      const styleName = item.styleName ?? 'mark_pen'
      const styleType = resolveMarkStyleType(styleName, writingMode)
      const className = [
        styleName,
        PDF_MARK_MASK_CLASS,
        writingMode !== 'horizontal-tb' ? styleType : '',
        item.className ?? '',
      ]
        .filter(Boolean)
        .join(' ')
      paintRects(layer, [scaled], {
        id: item.id,
        className,
        idAttr: MARK_HIGHLIGHT_ID_ATTR,
        attrs: {
          [MARK_TYPE_ATTR]: item.type,
          [MARK_STYLE_ATTR]: styleName,
        },
        extraStyle: getCustomColorStyleText(styleType, item.customColor),
        replace: false,
      })
    }
  }

  private paintSearchItem = (item: HighlightItem) => {
    const pageNumber = item.pageNumber
    if (pageNumber == null || !item.rects?.length) {
      return
    }
    const doc = this.getDocByPageNumber(pageNumber)
    const pageEl = doc?.getContentContainer()
    if (!pageEl) {
      return
    }
    const layer = ensureOverlayLayer(pageEl, PDF_SEARCH_LAYER_CLASS, {
      relativeClass: PDF_PAGE_RELATIVE_CLASS,
    })
    const className = [
      PDF_SEARCH_HIT_CLASS,
      item.active ? PDF_SEARCH_HIT_ACTIVE_CLASS : '',
      item.className ?? '',
    ]
      .filter(Boolean)
      .join(' ')
    paintRects(layer, item.rects as OverlayRect[], {
      id: item.id,
      className,
      idAttr: MARK_HIGHLIGHT_ID_ATTR,
      attrs: {
        [MARK_TYPE_ATTR]: item.type,
      },
    })
  }

  private getDocByPageNumber = (pageNumber: number): IPdfDocument | undefined =>
    this.renderer.getDocuments().find((doc) => doc.pageNumber === pageNumber)
}
