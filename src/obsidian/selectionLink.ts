export type PdfDeepLink = {
  page?: number
  selection?: string
  markId?: string
  /**
   * Page rectangle `x1,y1,x2,y2` in PDF default user space:
   * `(x1,y1)` lower-left, `(x2,y2)` upper-right; y increases upward.
   * Written as `foxycape-rect=…`; `rect=…` is also accepted when parsing.
   */
  rect?: string
  /**
   * Image file name used to bind a PDF location link to a specific pasted image
   * (`name=p103-934R.png`). Ignored when navigating the PDF.
   */
  name?: string
}

/** Deep-link query key for Foxycape image / screenshot location rects. */
export const FOXYCAPE_RECT_PARAM = 'foxycape-rect'

/** Legacy parameter name accepted when parsing deep links. */
export const LEGACY_RECT_PARAM = 'rect'

/** Binds a PDF image-location link to a vault image file name. */
export const FOXYCAPE_IMAGE_NAME_PARAM = 'name'

/**
 * Axis-aligned rect in PDF default user space (PDF annotation convention).
 * `(x1, y1)` = lower-left, `(x2, y2)` = upper-right.
 */
export type PdfUserSpaceRect = {
  x1: number
  y1: number
  x2: number
  y2: number
}

/** @deprecated Use {@link PdfUserSpaceRect}. */
export type PdfNormalizedRect = PdfUserSpaceRect

export type PdfSelectionBoundary = {
  itemIndex: number
  offset: number
}

const findPageElement = (node: Node | null): HTMLElement | null => {
  let el: Node | null = node
  while (el) {
    if (
      el.nodeType === Node.ELEMENT_NODE &&
      (el as Element).classList?.contains('page') &&
      (el as Element).hasAttribute('data-page-number')
    ) {
      return el as HTMLElement
    }
    el = el.parentElement ?? (el.parentNode as Node | null)
  }
  return null
}

const getPageNumber = (pageEl: Element | null): number | undefined => {
  if (!pageEl) {
    return undefined
  }
  const raw = pageEl.getAttribute('data-page-number')
  if (!raw) {
    return undefined
  }
  const pageNumber = Number.parseInt(raw, 10)
  return Number.isFinite(pageNumber) ? pageNumber : undefined
}

const resolveBoundaryInElement = (
  el: Element,
  textNode: Text | null,
  offset: number,
): PdfSelectionBoundary | null => {
  const indexed = el.closest('[data-text-index]') ?? (el.hasAttribute('data-text-index') ? el : null)
  if (indexed) {
    const itemIndex = Number.parseInt(indexed.getAttribute('data-text-index') ?? '', 10)
    if (!Number.isFinite(itemIndex)) {
      return null
    }
    const text = indexed.textContent ?? ''
    const safeOffset = Math.max(0, Math.min(offset, text.length))
    return { itemIndex, offset: safeOffset }
  }

  const pageEl = findPageElement(el)
  if (!pageEl) {
    return null
  }

  const spans = Array.from(pageEl.querySelectorAll('.textLayer span')).filter((span) => {
    if (span.classList.contains('highlight') || span.classList.contains('appended')) {
      return false
    }
    return (span.textContent?.length ?? 0) > 0
  })
  const span = el.closest('.textLayer span') as HTMLElement | null
  if (!span) {
    return null
  }
  const itemIndex = spans.indexOf(span)
  if (itemIndex < 0) {
    return null
  }
  const text = span.textContent ?? ''
  let charOffset = offset
  if (textNode && textNode.parentElement === span) {
    let before = 0
    for (const child of Array.from(span.childNodes)) {
      if (child === textNode) {
        break
      }
      before += child.textContent?.length ?? 0
    }
    charOffset = before + offset
  }
  return {
    itemIndex,
    offset: Math.max(0, Math.min(charOffset, text.length)),
  }
}

const resolveBoundary = (node: Node, offset: number): PdfSelectionBoundary | null => {
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentElement
    if (!parent) {
      return null
    }
    return resolveBoundaryInElement(parent, node as Text, offset)
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as Element
    const child = el.childNodes[offset] ?? el.childNodes[offset - 1] ?? null
    if (child?.nodeType === Node.TEXT_NODE) {
      const textOffset = child === el.childNodes[offset] ? 0 : (child.textContent?.length ?? 0)
      return resolveBoundaryInElement(el, child as Text, textOffset)
    }
    return resolveBoundaryInElement(el, null, 0)
  }
  return null
}

/**
 * Map a DOM Range to Obsidian's `selection=beginIdx,beginOffset,endIdx,endOffset`
 * (textContent item indices). Cross-page ranges return null.
 */
export const rangeToObsidianSelection = (range: Range): string | undefined => {
  if (!range || range.collapsed) {
    return undefined
  }
  const startPage = getPageNumber(findPageElement(range.startContainer))
  const endPage = getPageNumber(findPageElement(range.endContainer))
  if (startPage == null || endPage == null || startPage !== endPage) {
    return undefined
  }
  const begin = resolveBoundary(range.startContainer, range.startOffset)
  const end = resolveBoundary(range.endContainer, range.endOffset)
  if (!begin || !end) {
    return undefined
  }
  return `${begin.itemIndex},${begin.offset},${end.itemIndex},${end.offset}`
}

/** Page number for a DOM Range (start container). Cross-page not validated. */
export const getRangePageNumber = (range: Range): number | undefined => {
  if (!range) {
    return undefined
  }
  return getPageNumber(findPageElement(range.startContainer))
}

const formatPdfUserSpaceCoord = (value: number): string =>
  String(Number(value.toFixed(3)))

/** Serialize `x1,y1,x2,y2` in PDF user space (lower-left → upper-right). */
export const formatRectTuple = (rect: PdfUserSpaceRect): string => {
  return [
    formatPdfUserSpaceCoord(rect.x1),
    formatPdfUserSpaceCoord(rect.y1),
    formatPdfUserSpaceCoord(rect.x2),
    formatPdfUserSpaceCoord(rect.y2),
  ].join(',')
}

/**
 * Build a `foxycape-rect=` value from a canvas-space image box.
 * Output is PDF default user space: lower-left `(x1,y1)`, upper-right `(x2,y2)`.
 */
export const buildPdfUserSpaceRectParam = (options: {
  x: number
  y: number
  width: number
  height: number
  canvasWidth: number
  canvasHeight: number
  pageOriginWidth: number
  pageOriginHeight: number
}): string | undefined => {
  const {
    x,
    y,
    width,
    height,
    canvasWidth,
    canvasHeight,
    pageOriginWidth,
    pageOriginHeight,
  } = options
  if (
    !(canvasWidth > 0) ||
    !(canvasHeight > 0) ||
    !(pageOriginWidth > 0) ||
    !(pageOriginHeight > 0) ||
    !(width > 0) ||
    !(height > 0) ||
    !Number.isFinite(x) ||
    !Number.isFinite(y)
  ) {
    return undefined
  }
  const scaleX = pageOriginWidth / canvasWidth
  const scaleY = pageOriginHeight / canvasHeight
  const x1 = x * scaleX
  const x2 = (x + width) * scaleX
  // Canvas y is top-down; PDF y is bottom-up.
  const y2 = pageOriginHeight - y * scaleY
  const y1 = pageOriginHeight - (y + height) * scaleY
  if (!(x2 > x1) || !(y2 > y1)) {
    return undefined
  }
  return formatRectTuple({ x1, y1, x2, y2 })
}

export const buildPdfDeepLinkFragment = (options: {
  pageNumber?: number
  selection?: string
  markId?: string
  rect?: string
  /** Image basename; written as `name=` for right-click matching. */
  name?: string
}): string => {
  const parts: string[] = []
  if (options.pageNumber != null && options.pageNumber > 0) {
    parts.push(`page=${options.pageNumber}`)
  }
  if (options.selection) {
    parts.push(`selection=${options.selection}`)
  }
  if (options.markId) {
    parts.push(`markId=${encodeURIComponent(options.markId)}`)
  }
  if (options.rect) {
    parts.push(`${FOXYCAPE_RECT_PARAM}=${options.rect}`)
  }
  if (options.name) {
    parts.push(`${FOXYCAPE_IMAGE_NAME_PARAM}=${encodeURIComponent(options.name)}`)
  }
  return `#${parts.join('&')}`
}

/** Drop non-navigation params (e.g. `name=`) before opening a PDF deep link. */
export const toNavigablePdfSubpath = (
  subpath: string | null | undefined,
): string | undefined => {
  const deep = parsePdfDeepLink(subpath)
  if (deep.page == null && !deep.selection && !deep.markId && !deep.rect) {
    return undefined
  }
  return buildPdfDeepLinkFragment({
    pageNumber: deep.page,
    selection: deep.selection,
    markId: deep.markId,
    rect: deep.rect,
  })
}

export const resolveRectParamFromSearchParams = (
  params: URLSearchParams,
): string | undefined => {
  // Prefer our namespaced key; fall back to legacy `rect=`.
  const preferred = params.get(FOXYCAPE_RECT_PARAM) ?? params.get(LEGACY_RECT_PARAM)
  return parseRectTuple(preferred ?? undefined) ? preferred! : undefined
}

export const parsePdfDeepLink = (subpath: string | null | undefined): PdfDeepLink => {
  if (!subpath) {
    return {}
  }
  const raw = subpath.startsWith('#') ? subpath.slice(1) : subpath
  const params = new URLSearchParams(raw.replace(/&/g, '&'))
  // URLSearchParams handles `page=1&selection=…&markId=…&foxycape-rect=…` (or `rect=…`)
  const pageRaw = params.get('page')
  const page = pageRaw ? Number.parseInt(pageRaw, 10) : undefined
  const selection = params.get('selection') ?? undefined
  const markIdRaw = params.get('markId')
  const markId = markIdRaw ? decodeURIComponent(markIdRaw) : undefined
  const rect = resolveRectParamFromSearchParams(params)
  const nameRaw = params.get(FOXYCAPE_IMAGE_NAME_PARAM)
  let name: string | undefined
  if (nameRaw) {
    try {
      name = decodeURIComponent(nameRaw)
    } catch {
      name = nameRaw
    }
  }
  return {
    page: page != null && Number.isFinite(page) ? page : undefined,
    selection: selection || undefined,
    markId: markId || undefined,
    rect,
    name: name || undefined,
  }
}

export const parseSelectionTuple = (
  selection: string | undefined,
): [number, number, number, number] | undefined => {
  if (!selection) {
    return undefined
  }
  const parts = selection.split(',').map((p) => Number.parseInt(p.trim(), 10))
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    return undefined
  }
  return [parts[0], parts[1], parts[2], parts[3]]
}

/**
 * Parse `x1,y1,x2,y2` in PDF default user space
 * (lower-left → upper-right; y increases upward).
 */
export const parseRectTuple = (
  rect: string | undefined,
): [number, number, number, number] | undefined => {
  if (!rect) {
    return undefined
  }
  const parts = rect.split(',').map((p) => Number.parseFloat(p.trim()))
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    return undefined
  }
  const [x1, y1, x2, y2] = parts
  if (!(x2 > x1) || !(y2 > y1)) {
    return undefined
  }
  return [x1, y1, x2, y2]
}

export const formatMarkQuoteLine = (text: string, markdownLink: string): string => {
  const quote = text.replace(/\s+/g, ' ').trim()
  return `> ${quote} ${markdownLink}`
}
