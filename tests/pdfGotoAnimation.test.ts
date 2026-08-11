import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PDF_GOTO_ANIMATION_CLASS,
  PDF_GOTO_ANIMATION_MS,
  playGotoHighlightAnimation,
} from '../src/marker/PdfGotoAnimation'

describe('playGotoHighlightAnimation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.replaceChildren()
  })

  it('adds the flash class and removes it after 2s', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)

    playGotoHighlightAnimation([el])

    expect(el.classList.contains(PDF_GOTO_ANIMATION_CLASS)).toBe(true)

    vi.advanceTimersByTime(PDF_GOTO_ANIMATION_MS)
    expect(el.classList.contains(PDF_GOTO_ANIMATION_CLASS)).toBe(false)
    expect(el.isConnected).toBe(true)
  })

  it('removes temporary overlay nodes when requested', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)

    playGotoHighlightAnimation([el], { removeElements: true })
    vi.advanceTimersByTime(PDF_GOTO_ANIMATION_MS)

    expect(el.isConnected).toBe(false)
  })
})
