export type Box = {
  left: number
  top: number
  width: number
  height: number
}

export type MenuPlacement = 'below' | 'above' | 'center'

export type ScreenshotMenuPosition = {
  left: number
  top: number
  placement: MenuPlacement
}

/**
 * Right-align the menu with the selection. Prefer below, then above, then
 * vertically centered over the selection. Clamp into the viewport.
 */
export const placeScreenshotMenu = (options: {
  selection: Box
  menu: { width: number; height: number }
  viewport: Box
  gap?: number
  padding?: number
}): ScreenshotMenuPosition => {
  const gap = options.gap ?? 8
  const pad = options.padding ?? 8
  const { selection, menu, viewport } = options
  const viewportRight = viewport.left + viewport.width
  const viewportBottom = viewport.top + viewport.height
  const minLeft = viewport.left + pad
  const maxLeft = viewportRight - menu.width - pad
  const leftUnclamped = selection.left + selection.width - menu.width
  const left =
    maxLeft < minLeft
      ? viewport.left + Math.max(0, (viewport.width - menu.width) / 2)
      : clamp(leftUnclamped, minLeft, maxLeft)

  const belowTop = selection.top + selection.height + gap
  if (belowTop + menu.height + pad <= viewportBottom) {
    return { left, top: belowTop, placement: 'below' }
  }

  const aboveTop = selection.top - menu.height - gap
  if (aboveTop >= viewport.top + pad) {
    return { left, top: aboveTop, placement: 'above' }
  }

  const centerTop = selection.top + (selection.height - menu.height) / 2
  const minTop = viewport.top + pad
  const maxTop = viewportBottom - menu.height - pad
  const top =
    maxTop < minTop
      ? viewport.top + Math.max(0, (viewport.height - menu.height) / 2)
      : clamp(centerTop, minTop, maxTop)
  return { left, top, placement: 'center' }
}

/**
 * Convert viewport coordinates into the local space of a `position: fixed`
 * element. Obsidian workspace leaves often have a `transform`, which makes
 * `fixed` relative to that ancestor instead of the viewport.
 */
export const toFixedContainingBlock = (
  viewportPos: { left: number; top: number },
  origin: { left: number; top: number },
): { left: number; top: number } => ({
  left: viewportPos.left - origin.left,
  top: viewportPos.top - origin.top,
})

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
