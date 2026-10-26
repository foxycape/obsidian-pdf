import { describe, expect, it } from 'vitest'
import { placeBesideSelection } from '../src/screenshot/placeBesideSelection'

const viewport = { left: 0, top: 0, width: 800, height: 600 }
const card = { width: 360, height: 280 }

describe('placeBesideSelection', () => {
  it('places below the selection when that side has the largest fitting gap', () => {
    const frame = placeBesideSelection({
      selection: { left: 40, top: 40, width: 200, height: 80 },
      card,
      viewport,
    })
    expect(frame.placement).toBe('below')
    expect(frame.left).toBe(40)
    expect(frame.top).toBe(40 + 80 + 8)
    expect(frame.maxWidth).toBe(360)
    expect(frame.maxHeight).toBe(280)
  })

  it('places above and keeps the card against the selection', () => {
    const frame = placeBesideSelection({
      selection: { left: 40, top: 520, width: 200, height: 60 },
      card: { width: 360, height: 200 },
      viewport,
    })
    expect(frame.placement).toBe('above')
    expect(frame.left).toBe(40)
    expect(frame.top).toBe(520 - 8 - 200)
    expect(frame.maxWidth).toBe(360)
    expect(frame.maxHeight).toBe(200)
  })

  it('prefers a side that fits the card over a larger side that does not', () => {
    const frame = placeBesideSelection({
      selection: { left: 8, top: 8, width: 1600, height: 300 },
      card: { width: 300, height: 200 },
      viewport: { left: 0, top: 0, width: 2000, height: 500 },
    })
    expect(frame.placement).toBe('right')
    expect(frame.left).toBe(8 + 1600 + 8)
    expect(frame.top).toBe(8)
    expect(frame.maxWidth).toBe(300)
    expect(frame.maxHeight).toBe(200)
  })

  it('shrinks onto the largest gap when no side can hold the card', () => {
    const frame = placeBesideSelection({
      selection: { left: 100, top: 100, width: 200, height: 200 },
      card: { width: 200, height: 200 },
      viewport: { left: 0, top: 0, width: 400, height: 400 },
    })
    expect(frame.placement).toBe('below')
    expect(frame.left).toBe(100)
    expect(frame.top).toBe(100 + 200 + 8)
    expect(frame.maxWidth).toBe(200)
    expect(frame.maxHeight).toBe(400 - 8 - (100 + 200 + 8))
  })

  it('keeps a bottom band clear of the selection center when the selection fills the viewport', () => {
    const frame = placeBesideSelection({
      selection: { left: 0, top: 0, width: 400, height: 400 },
      card: { width: 320, height: 400 },
      viewport: { left: 0, top: 0, width: 400, height: 400 },
    })
    expect(frame.placement).toBe('below')
    expect(frame.left).toBe(8)
    expect(frame.maxWidth).toBe(320)
    expect(frame.maxHeight).toBeCloseTo((400 - 16) * 0.4)
    expect(frame.top).toBeCloseTo(400 - 8 - frame.maxHeight)
    expect(frame.top).toBeGreaterThan(200)
  })

  it('stays clear of a selection sliver that remains in the viewport', () => {
    const frame = placeBesideSelection({
      selection: { left: 40, top: -180, width: 200, height: 200 },
      card,
      viewport,
    })
    expect(frame.placement).toBe('below')
    expect(frame.top).toBe(20 + 8)
    expect(frame.left).toBe(40)
    expect(frame.maxWidth).toBe(360)
    expect(frame.maxHeight).toBe(280)
  })
})
