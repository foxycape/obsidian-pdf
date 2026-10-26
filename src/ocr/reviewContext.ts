/** Characters of PDF text kept before and after the cropped region. */
export const REVIEW_CONTEXT_RADIUS = 250

export type UserRect = {
  left: number
  bottom: number
  right: number
  top: number
}

export type ReviewTextItem = {
  str: string
  width?: number
  height?: number
  hasEOL?: boolean
  transform?: number[]
}

/** Expand a hit span by `radius` characters, stopping at the ends of the page text. */
export const sliceTextWindow = (
  text: string,
  hitStart: number,
  hitEnd: number,
  radius = REVIEW_CONTEXT_RADIUS,
): string => {
  if (!text || !(hitEnd > hitStart)) {
    return ''
  }
  const start = Math.max(0, hitStart - radius)
  const end = Math.min(text.length, hitEnd + radius)
  return text.slice(start, end).trim()
}

/** Canvas pixels (top-left origin) to PDF user space (y grows upward). */
export const canvasPixelsToUserRect = (
  pixels: { x: number; y: number; width: number; height: number },
  canvasWidth: number,
  canvasHeight: number,
  view: number[],
): UserRect | null => {
  const xMin = view[0]
  const yMin = view[1]
  const xMax = view[2]
  const yMax = view[3]
  if (
    !(canvasWidth > 0) ||
    !(canvasHeight > 0) ||
    typeof xMin !== 'number' ||
    typeof yMin !== 'number' ||
    typeof xMax !== 'number' ||
    typeof yMax !== 'number' ||
    !(xMax > xMin) ||
    !(yMax > yMin) ||
    !(pixels.width > 0) ||
    !(pixels.height > 0)
  ) {
    return null
  }
  const pageWidth = xMax - xMin
  const pageHeight = yMax - yMin
  const left = xMin + (pixels.x / canvasWidth) * pageWidth
  const right = xMin + ((pixels.x + pixels.width) / canvasWidth) * pageWidth
  const top = yMax - (pixels.y / canvasHeight) * pageHeight
  const bottom = yMax - ((pixels.y + pixels.height) / canvasHeight) * pageHeight
  if (!(right > left) || !(top > bottom)) {
    return null
  }
  return { left, bottom, right, top }
}

const itemBox = (item: ReviewTextItem): UserRect | null => {
  const transform = item.transform
  if (!transform || transform.length < 6 || !item.str) {
    return null
  }
  const x = transform[4]
  const y = transform[5]
  if (typeof x !== 'number' || typeof y !== 'number') {
    return null
  }
  const width = Math.abs(item.width ?? 0)
  const height = Math.abs(item.height ?? Math.hypot(transform[2] ?? 0, transform[3] ?? 0))
  if (!(width > 0) || !(height > 0)) {
    return null
  }
  const left = Math.min(x, x + (item.width ?? width))
  const right = Math.max(x, x + (item.width ?? width))
  return { left, bottom: y, right, top: y + height }
}

const intersects = (box: UserRect, region: UserRect): boolean =>
  box.left < region.right &&
  box.right > region.left &&
  box.bottom < region.top &&
  box.top > region.bottom

/** PDF text overlapping `region`, plus the surrounding character window. */
export const collectReviewReference = (
  items: readonly ReviewTextItem[],
  region: UserRect,
  radius = REVIEW_CONTEXT_RADIUS,
): string => {
  let text = ''
  let hitStart = -1
  let hitEnd = -1
  for (const item of items) {
    const piece = item.str ?? ''
    if (!piece) {
      continue
    }
    const start = text.length
    text += piece
    const box = itemBox(item)
    if (box && intersects(box, region)) {
      hitStart = hitStart < 0 ? start : hitStart
      hitEnd = text.length
    }
    if (item.hasEOL) {
      text += '\n'
    }
  }
  return sliceTextWindow(text, hitStart, hitEnd, radius)
}
