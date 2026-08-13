import { describe, expect, it } from 'vitest'
import {
  clampRect,
  clientPointToPageCss,
  getPageNumberFromEl,
  intersectRects,
  isRectLargeEnough,
  layoutStitchRows,
  mapClientRectToCanvasPixels,
  mapPageCssRectToCanvasPixels,
  MIN_SCREENSHOT_SIZE,
  normalizeRect,
  ratiosToRect,
  rectToRatios,
  resizeRect,
} from '../src/screenshot/screenshotGeometry'

const bounds = { width: 400, height: 300 }

describe('normalizeRect', () => {
  it('orders inverted drag points', () => {
    expect(normalizeRect(80, 90, 20, 30)).toEqual({
      x: 20,
      y: 30,
      width: 60,
      height: 60,
    })
  })
})

describe('clampRect', () => {
  it('clips to the page box', () => {
    expect(clampRect({ x: -10, y: -5, width: 50, height: 40 }, bounds)).toEqual({
      x: 0,
      y: 0,
      width: 40,
      height: 35,
    })
    expect(clampRect({ x: 380, y: 280, width: 40, height: 40 }, bounds)).toEqual({
      x: 380,
      y: 280,
      width: 20,
      height: 20,
    })
  })
})

describe('isRectLargeEnough', () => {
  it('rejects thin or short rects', () => {
    expect(isRectLargeEnough({ x: 0, y: 0, width: MIN_SCREENSHOT_SIZE, height: MIN_SCREENSHOT_SIZE })).toBe(
      true,
    )
    expect(isRectLargeEnough({ x: 0, y: 0, width: MIN_SCREENSHOT_SIZE - 1, height: 20 })).toBe(
      false,
    )
  })
})

describe('rect ratios', () => {
  it('round-trips through zoom-style size changes', () => {
    const rect = { x: 40, y: 30, width: 80, height: 60 }
    const ratios = rectToRatios(rect, bounds)
    expect(ratiosToRect(ratios, { width: 800, height: 600 })).toEqual({
      x: 80,
      y: 60,
      width: 160,
      height: 120,
    })
  })
})

describe('resizeRect', () => {
  const origin = { x: 100, y: 80, width: 120, height: 90 }

  it('moves the east edge and keeps the west anchored', () => {
    expect(resizeRect(origin, 'e', { x: 250, y: 120 }, bounds)).toEqual({
      x: 100,
      y: 80,
      width: 150,
      height: 90,
    })
  })

  it('moves the north-west corner', () => {
    expect(resizeRect(origin, 'nw', { x: 70, y: 50 }, bounds)).toEqual({
      x: 70,
      y: 50,
      width: 150,
      height: 120,
    })
  })

  it('allows crossing the opposite edge then normalizes', () => {
    const next = resizeRect(origin, 'nw', { x: 250, y: 200 }, bounds)
    expect(next.x).toBe(220)
    expect(next.y).toBe(170)
    expect(next.width).toBe(30)
    expect(next.height).toBe(30)
  })

  it('enforces min size against the anchored edge', () => {
    const next = resizeRect(origin, 'e', { x: 102, y: 100 }, bounds)
    expect(next.x).toBe(100)
    expect(next.width).toBe(MIN_SCREENSHOT_SIZE)
    expect(next.height).toBe(90)
  })
})

describe('clientPointToPageCss', () => {
  it('subtracts the page border from client coordinates', () => {
    const pageEl = {
      getBoundingClientRect: () =>
        ({ left: 40, top: 20, width: 200, height: 100 }) as DOMRect,
      clientLeft: 4,
      clientTop: 3,
    }
    expect(clientPointToPageCss(84, 53, pageEl)).toEqual({ x: 40, y: 30 })
  })
})

describe('mapPageCssRectToCanvasPixels', () => {
  it('maps CSS rects onto backing-store pixels with DPR', () => {
    const pageEl = {
      getBoundingClientRect: () =>
        ({ left: 10, top: 20, width: 210, height: 310 }) as DOMRect,
      clientLeft: 5,
      clientTop: 5,
    }
    const canvas = {
      getBoundingClientRect: () =>
        ({ left: 15, top: 25, width: 200, height: 300 }) as DOMRect,
      width: 400,
      height: 600,
    }
    expect(
      mapPageCssRectToCanvasPixels({ x: 10, y: 20, width: 50, height: 40 }, pageEl, canvas),
    ).toEqual({
      x: 20,
      y: 40,
      width: 100,
      height: 80,
    })
  })
})

describe('getPageNumberFromEl', () => {
  it('reads data-page-number', () => {
    const el = document.createElement('div')
    el.dataset.pageNumber = '3'
    expect(getPageNumberFromEl(el)).toBe(3)
  })

  it('rejects invalid values', () => {
    const el = document.createElement('div')
    expect(getPageNumberFromEl(el)).toBeNull()
  })
})

describe('intersectRects', () => {
  it('returns the overlap', () => {
    expect(
      intersectRects({ x: 0, y: 0, width: 100, height: 80 }, { x: 60, y: 50, width: 80, height: 60 }),
    ).toEqual({ x: 60, y: 50, width: 40, height: 30 })
  })

  it('returns null when disjoint', () => {
    expect(
      intersectRects({ x: 0, y: 0, width: 10, height: 10 }, { x: 20, y: 20, width: 10, height: 10 }),
    ).toBeNull()
  })
})

describe('layoutStitchRows', () => {
  it('stacks vertically separated pages into rows', () => {
    const rows = layoutStitchRows([
      { x: 10, y: 200 },
      { x: 10, y: 20 },
    ])
    expect(rows).toHaveLength(2)
    expect(rows[0][0].y).toBe(20)
    expect(rows[1][0].y).toBe(200)
  })

  it('keeps side-by-side pages in one row, left to right', () => {
    const rows = layoutStitchRows([
      { x: 220, y: 40 },
      { x: 40, y: 42 },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].map((piece) => piece.x)).toEqual([40, 220])
  })
})

describe('mapClientRectToCanvasPixels', () => {
  it('maps the overlapping client rect onto backing-store pixels', () => {
    const canvas = {
      getBoundingClientRect: () =>
        ({ left: 15, top: 25, width: 200, height: 300 }) as DOMRect,
      width: 400,
      height: 600,
    }
    expect(
      mapClientRectToCanvasPixels({ x: 25, y: 45, width: 50, height: 40 }, canvas),
    ).toEqual({
      x: 20,
      y: 40,
      width: 100,
      height: 80,
    })
  })
})
