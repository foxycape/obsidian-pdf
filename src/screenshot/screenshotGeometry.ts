export const MIN_SCREENSHOT_SIZE = 8

export const HANDLE_IDS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const

export type ScreenshotHandle = (typeof HANDLE_IDS)[number]

export type CssRect = {
  x: number
  y: number
  width: number
  height: number
}

export type Size = {
  width: number
  height: number
}

export type Point = {
  x: number
  y: number
}

export type RectRatios = {
  x: number
  y: number
  width: number
  height: number
}

export const HANDLE_CURSOR: Record<ScreenshotHandle, string> = {
  nw: 'nwse-resize',
  se: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export const normalizeRect = (x1: number, y1: number, x2: number, y2: number): CssRect => {
  const x = Math.min(x1, x2)
  const y = Math.min(y1, y2)
  return {
    x,
    y,
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  }
}

export const clampRect = (rect: CssRect, bounds: Size): CssRect => {
  let { x, y, width, height } = rect
  if (x < 0) {
    width += x
    x = 0
  }
  if (y < 0) {
    height += y
    y = 0
  }
  if (x + width > bounds.width) {
    width = bounds.width - x
  }
  if (y + height > bounds.height) {
    height = bounds.height - y
  }
  return {
    x,
    y,
    width: Math.max(0, width),
    height: Math.max(0, height),
  }
}

export const isRectLargeEnough = (
  rect: CssRect,
  minSize: number = MIN_SCREENSHOT_SIZE,
): boolean => rect.width >= minSize && rect.height >= minSize

export const rectToRatios = (rect: CssRect, size: Size): RectRatios => ({
  x: size.width > 0 ? rect.x / size.width : 0,
  y: size.height > 0 ? rect.y / size.height : 0,
  width: size.width > 0 ? rect.width / size.width : 0,
  height: size.height > 0 ? rect.height / size.height : 0,
})

export const ratiosToRect = (ratios: RectRatios, size: Size): CssRect =>
  clampRect(
    {
      x: ratios.x * size.width,
      y: ratios.y * size.height,
      width: ratios.width * size.width,
      height: ratios.height * size.height,
    },
    size,
  )

export const clientPointToPageCss = (
  clientX: number,
  clientY: number,
  pageEl: {
    getBoundingClientRect: () => DOMRect
    clientLeft: number
    clientTop: number
  },
): Point => {
  const box = pageEl.getBoundingClientRect()
  return {
    x: clientX - box.left - pageEl.clientLeft,
    y: clientY - box.top - pageEl.clientTop,
  }
}

export const intersectRects = (a: CssRect, b: CssRect): CssRect | null => {
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  const right = Math.min(a.x + a.width, b.x + b.width)
  const bottom = Math.min(a.y + a.height, b.y + b.height)
  if (!(right > x) || !(bottom > y)) {
    return null
  }
  return { x, y, width: right - x, height: bottom - y }
}

export type StitchPieceBox = {
  x: number
  y: number
}

/** Group pieces into visual rows (same band of Y), left-to-right within each row. */
export const layoutStitchRows = <T extends StitchPieceBox>(
  pieces: T[],
  rowTolerance = 24,
): T[][] => {
  const sorted = [...pieces].sort((a, b) => a.y - b.y || a.x - b.x)
  const rows: T[][] = []
  for (const piece of sorted) {
    const row = rows[rows.length - 1]
    if (row && Math.abs(piece.y - row[0].y) <= rowTolerance) {
      row.push(piece)
    } else {
      rows.push([piece])
    }
  }
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x)
  }
  return rows
}

/** Map a viewport-space rect onto canvas backing-store pixels. */
export const mapClientRectToCanvasPixels = (
  clientRect: CssRect,
  canvas: CanvasBoxLike,
): CssRect | null => {
  const canvasBox = canvas.getBoundingClientRect()
  if (
    !(canvasBox.width > 0) ||
    !(canvasBox.height > 0) ||
    !(canvas.width > 0) ||
    !(canvas.height > 0) ||
    !(clientRect.width > 0) ||
    !(clientRect.height > 0)
  ) {
    return null
  }
  const scaleX = canvas.width / canvasBox.width
  const scaleY = canvas.height / canvasBox.height
  const overlap = intersectRects(clientRect, {
    x: canvasBox.left,
    y: canvasBox.top,
    width: canvasBox.width,
    height: canvasBox.height,
  })
  if (!overlap) {
    return null
  }
  const x = (overlap.x - canvasBox.left) * scaleX
  const y = (overlap.y - canvasBox.top) * scaleY
  const width = overlap.width * scaleX
  const height = overlap.height * scaleY
  const clamped = clampRect(
    { x, y, width, height },
    { width: canvas.width, height: canvas.height },
  )
  if (!isRectLargeEnough(clamped, 1)) {
    return null
  }
  return clamped
}

/**
 * Resize `origin` from a handle. Opposite edges stay anchored at pointerdown.
 * Crossing an edge is allowed (the rect is re-normalized).
 */
export const resizeRect = (
  origin: CssRect,
  handle: ScreenshotHandle,
  pointer: Point,
  bounds: Size,
  minSize: number = MIN_SCREENSHOT_SIZE,
): CssRect => {
  const fixedLeft = origin.x
  const fixedTop = origin.y
  const fixedRight = origin.x + origin.width
  const fixedBottom = origin.y + origin.height
  const px = clamp(pointer.x, 0, bounds.width)
  const py = clamp(pointer.y, 0, bounds.height)

  let left = fixedLeft
  let top = fixedTop
  let right = fixedRight
  let bottom = fixedBottom

  switch (handle) {
    case 'nw':
      left = px
      top = py
      break
    case 'n':
      top = py
      break
    case 'ne':
      right = px
      top = py
      break
    case 'e':
      right = px
      break
    case 'se':
      right = px
      bottom = py
      break
    case 's':
      bottom = py
      break
    case 'sw':
      left = px
      bottom = py
      break
    case 'w':
      left = px
      break
  }

  let x = Math.min(left, right)
  let y = Math.min(top, bottom)
  let width = Math.abs(right - left)
  let height = Math.abs(bottom - top)

  if (width < minSize) {
    const movingWest = handle === 'w' || handle === 'nw' || handle === 'sw'
    if (movingWest) {
      x = clamp(fixedRight - minSize, 0, Math.max(0, bounds.width - minSize))
    } else {
      x = clamp(fixedLeft, 0, Math.max(0, bounds.width - minSize))
    }
    width = Math.min(minSize, bounds.width)
  }

  if (height < minSize) {
    const movingNorth = handle === 'n' || handle === 'nw' || handle === 'ne'
    if (movingNorth) {
      y = clamp(fixedBottom - minSize, 0, Math.max(0, bounds.height - minSize))
    } else {
      y = clamp(fixedTop, 0, Math.max(0, bounds.height - minSize))
    }
    height = Math.min(minSize, bounds.height)
  }

  return clampRect({ x, y, width, height }, bounds)
}

export type PageBoxLike = {
  getBoundingClientRect: () => DOMRect
  clientLeft: number
  clientTop: number
}

export type CanvasBoxLike = {
  getBoundingClientRect: () => DOMRect
  width: number
  height: number
}

/** Map a page-content CSS rect onto canvas backing-store pixels. */
export const mapPageCssRectToCanvasPixels = (
  rect: CssRect,
  pageEl: PageBoxLike,
  canvas: CanvasBoxLike,
): CssRect | null => {
  const pageBox = pageEl.getBoundingClientRect()
  const canvasBox = canvas.getBoundingClientRect()
  if (
    !(canvasBox.width > 0) ||
    !(canvasBox.height > 0) ||
    !(canvas.width > 0) ||
    !(canvas.height > 0) ||
    !(rect.width > 0) ||
    !(rect.height > 0)
  ) {
    return null
  }
  const scaleX = canvas.width / canvasBox.width
  const scaleY = canvas.height / canvasBox.height
  const clientLeft = pageBox.left + pageEl.clientLeft + rect.x
  const clientTop = pageBox.top + pageEl.clientTop + rect.y
  const x = (clientLeft - canvasBox.left) * scaleX
  const y = (clientTop - canvasBox.top) * scaleY
  const width = rect.width * scaleX
  const height = rect.height * scaleY
  const clamped = clampRect(
    { x, y, width, height },
    { width: canvas.width, height: canvas.height },
  )
  if (!isRectLargeEnough(clamped, 1)) {
    return null
  }
  return clamped
}

export const findPageElementAtPoint = (
  doc: Document,
  clientX: number,
  clientY: number,
  root: ParentNode,
): HTMLElement | null => {
  const stack = doc.elementsFromPoint(clientX, clientY)
  for (const el of stack) {
    if (!el.instanceOf(Element)) {
      continue
    }
    const page =
      el.instanceOf(HTMLElement) && el.classList.contains('page')
        ? el
        : el.closest<HTMLElement>('.page')
    if (page && root.contains(page)) {
      return page
    }
  }
  return null
}

export const getPageNumberFromEl = (pageEl: HTMLElement): number | null => {
  const raw = pageEl.dataset.pageNumber
  const n = raw ? Number(raw) : Number.NaN
  if (!Number.isFinite(n) || n < 1) {
    return null
  }
  return n
}
