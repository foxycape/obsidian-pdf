import type { Box } from './screenshotMenuPlacement'

export type BesideSide = 'above' | 'below' | 'left' | 'right'

export type OcrSheetFrame = {
  left: number | null
  top: number | null
  bottom: number | null
  maxWidth: number
  maxHeight: number
}

export type BesideFrame = {
  left: number
  top: number
  maxWidth: number
  maxHeight: number
  placement: BesideSide
}

const sideRank: Record<BesideSide, number> = {
  below: 0,
  above: 1,
  right: 2,
  left: 3,
}

type FreeRegion = {
  side: BesideSide
  left: number
  top: number
  width: number
  height: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const clipToView = (
  left: number,
  top: number,
  width: number,
  height: number,
  viewLeft: number,
  viewTop: number,
  viewRight: number,
  viewBottom: number,
): { left: number; top: number; width: number; height: number } => {
  const nextLeft = Math.max(left, viewLeft)
  const nextTop = Math.max(top, viewTop)
  const nextRight = Math.min(left + width, viewRight)
  const nextBottom = Math.min(top + height, viewBottom)
  return {
    left: nextLeft,
    top: nextTop,
    width: Math.max(0, nextRight - nextLeft),
    height: Math.max(0, nextBottom - nextTop),
  }
}

const prefers = (candidate: FreeRegion, current: FreeRegion): boolean => {
  const areaDelta = candidate.width * candidate.height - current.width * current.height
  if (areaDelta !== 0) {
    return areaDelta > 0
  }
  return sideRank[candidate.side] < sideRank[current.side]
}

const pickRegion = (regions: FreeRegion[]): FreeRegion | null => {
  let best: FreeRegion | null = null
  for (const region of regions) {
    if (!best || prefers(region, best)) {
      best = region
    }
  }
  return best
}

/**
 * Place a card in the free space around a selection. Prefer the side whose
 * viewport gap can contain the card and has the largest area. Otherwise use
 * the largest gap and shrink the card. A selection that fills the viewport
 * falls back to a band along the bottom edge.
 */
export const placeBesideSelection = (options: {
  selection: Box
  card: { width: number; height: number }
  viewport: Box
  gap?: number
  padding?: number
}): BesideFrame => {
  const gap = options.gap ?? 8
  const pad = options.padding ?? 8
  const { selection, card, viewport } = options
  const viewLeft = viewport.left + pad
  const viewTop = viewport.top + pad
  const viewRight = viewport.left + viewport.width - pad
  const viewBottom = viewport.top + viewport.height - pad
  const viewWidth = Math.max(0, viewRight - viewLeft)
  const viewHeight = Math.max(0, viewBottom - viewTop)
  const selLeft = selection.left
  const selTop = selection.top
  const selRight = selection.left + selection.width
  const selBottom = selection.top + selection.height

  const raw: Array<{ side: BesideSide; left: number; top: number; width: number; height: number }> = [
    {
      side: 'below',
      left: viewLeft,
      top: selBottom + gap,
      width: viewWidth,
      height: viewBottom - (selBottom + gap),
    },
    {
      side: 'above',
      left: viewLeft,
      top: viewTop,
      width: viewWidth,
      height: selTop - gap - viewTop,
    },
    {
      side: 'right',
      left: selRight + gap,
      top: viewTop,
      width: viewRight - (selRight + gap),
      height: viewHeight,
    },
    {
      side: 'left',
      left: viewLeft,
      top: viewTop,
      width: selLeft - gap - viewLeft,
      height: viewHeight,
    },
  ]

  const regions: FreeRegion[] = raw.map((region) => ({
    side: region.side,
    ...clipToView(region.left, region.top, region.width, region.height, viewLeft, viewTop, viewRight, viewBottom),
  }))

  const fitting = regions.filter((region) => region.width >= card.width && region.height >= card.height)
  const open = regions.filter((region) => region.width > 0 && region.height > 0)
  const chosen = pickRegion(fitting.length > 0 ? fitting : open)

  if (!chosen) {
    const maxWidth = Math.min(card.width, viewWidth)
    const maxHeight = Math.min(card.height, Math.max(0, viewHeight * 0.4))
    return {
      left: viewLeft,
      top: Math.max(viewTop, viewBottom - maxHeight),
      maxWidth,
      maxHeight,
      placement: 'below',
    }
  }

  const maxWidth = Math.min(card.width, chosen.width)
  const maxHeight = Math.min(card.height, chosen.height)
  if (chosen.side === 'below' || chosen.side === 'above') {
    const maxLeft = chosen.left + chosen.width - maxWidth
    const left = maxLeft < chosen.left ? chosen.left : clamp(selLeft, chosen.left, maxLeft)
    const top = chosen.side === 'below' ? chosen.top : chosen.top + chosen.height - maxHeight
    return { left, top, maxWidth, maxHeight, placement: chosen.side }
  }

  const maxTop = chosen.top + chosen.height - maxHeight
  const top = maxTop < chosen.top ? chosen.top : clamp(selTop, chosen.top, maxTop)
  const left = chosen.side === 'right' ? chosen.left : chosen.left + chosen.width - maxWidth
  return { left, top, maxWidth, maxHeight, placement: chosen.side }
}
