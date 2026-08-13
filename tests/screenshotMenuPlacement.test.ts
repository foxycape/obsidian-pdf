import { describe, expect, it } from 'vitest'
import {
  placeScreenshotMenu,
  toFixedContainingBlock,
} from '../src/screenshot/screenshotMenuPlacement'

const viewport = { left: 0, top: 0, width: 400, height: 400 }
const menu = { width: 120, height: 36 }

describe('placeScreenshotMenu', () => {
  it('places below and right-aligns with the selection', () => {
    const pos = placeScreenshotMenu({
      selection: { left: 50, top: 40, width: 200, height: 80 },
      menu,
      viewport,
    })
    expect(pos.placement).toBe('below')
    expect(pos.left).toBe(50 + 200 - 120)
    expect(pos.top).toBe(40 + 80 + 8)
  })

  it('places above when there is no room below', () => {
    const pos = placeScreenshotMenu({
      selection: { left: 50, top: 340, width: 200, height: 50 },
      menu,
      viewport,
    })
    expect(pos.placement).toBe('above')
    expect(pos.left).toBe(50 + 200 - 120)
    expect(pos.top).toBe(340 - 36 - 8)
  })

  it('centers vertically when neither below nor above fits', () => {
    const tight = { left: 0, top: 0, width: 400, height: 90 }
    const pos = placeScreenshotMenu({
      selection: { left: 40, top: 10, width: 200, height: 70 },
      menu,
      viewport: tight,
    })
    expect(pos.placement).toBe('center')
    expect(pos.left).toBe(40 + 200 - 120)
    expect(pos.top).toBe(10 + (70 - 36) / 2)
  })

  it('clamps a right-aligned menu into the viewport', () => {
    const pos = placeScreenshotMenu({
      selection: { left: 10, top: 20, width: 40, height: 40 },
      menu,
      viewport,
    })
    expect(pos.left).toBe(8)
  })
})

describe('toFixedContainingBlock', () => {
  it('subtracts a transformed ancestor origin from viewport coords', () => {
    expect(
      toFixedContainingBlock({ left: 250, top: 180 }, { left: 200, top: 80 }),
    ).toEqual({ left: 50, top: 100 })
  })
})
