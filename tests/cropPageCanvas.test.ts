import { describe, expect, it } from 'vitest'
import {
  cropCanvasRegion,
  exceedsOcrPageScale,
  mapCropToTargetViewport,
} from '../src/screenshot/cropPageCanvas'

describe('cropCanvasRegion', () => {
  it('returns null for an empty region', () => {
    const canvas = document.createElement('canvas')
    canvas.width = 10
    canvas.height = 10
    expect(cropCanvasRegion(canvas, { x: 0, y: 0, width: 0, height: 0 })).toBeNull()
  })

  it('skips OCR remapping when the page is already drawn above twice its original size', () => {
    expect(exceedsOcrPageScale(500, 200)).toBe(true)
    expect(exceedsOcrPageScale(400, 200)).toBe(false)
    expect(exceedsOcrPageScale(100, 200)).toBe(false)
  })

  it('scales a crop from the displayed canvas onto the twice-size viewport', () => {
    expect(
      mapCropToTargetViewport({
        crop: { x: 10, y: 20, width: 30, height: 40 },
        sourceWidth: 100,
        sourceHeight: 200,
        targetWidth: 400,
        targetHeight: 800,
      }),
    ).toEqual({ x: 40, y: 80, width: 120, height: 160 })
  })
})
