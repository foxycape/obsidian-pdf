import { describe, expect, it } from 'vitest'
import { cropCanvasRegion } from '../src/screenshot/cropPageCanvas'

describe('cropCanvasRegion', () => {
  it('returns null for an empty region', () => {
    const canvas = document.createElement('canvas')
    canvas.width = 10
    canvas.height = 10
    expect(cropCanvasRegion(canvas, { x: 0, y: 0, width: 0, height: 0 })).toBeNull()
  })
})
