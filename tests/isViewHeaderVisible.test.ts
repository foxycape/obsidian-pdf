import { afterEach, describe, expect, it, vi } from 'vitest'
import { isViewHeaderVisible } from '@/chrome/isViewHeaderVisible'

const makeHeaderTree = () => {
  const containerEl = document.createElement('div')
  const header = document.createElement('div')
  header.className = 'view-header'
  header.innerHTML = `
    <div class="view-header-left"></div>
    <div class="view-header-title-container"></div>
    <div class="view-actions"></div>
  `
  containerEl.appendChild(header)
  document.body.appendChild(containerEl)
  return { containerEl, header }
}

afterEach(() => {
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

describe('isViewHeaderVisible', () => {
  it('returns false when .view-header is missing', () => {
    const containerEl = document.createElement('div')
    expect(isViewHeaderVisible(containerEl)).toBe(false)
  })

  it('returns false when header is display:none', () => {
    const { containerEl, header } = makeHeaderTree()
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      display: 'none',
      visibility: 'visible',
    } as CSSStyleDeclaration)
    vi.spyOn(header, 'getBoundingClientRect').mockReturnValue({
      width: 400,
      height: 40,
      top: 0,
      left: 0,
      bottom: 40,
      right: 400,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
    expect(isViewHeaderVisible(containerEl)).toBe(false)
  })

  it('returns false when header has zero height', () => {
    const { containerEl, header } = makeHeaderTree()
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      display: 'flex',
      visibility: 'visible',
    } as CSSStyleDeclaration)
    vi.spyOn(header, 'getBoundingClientRect').mockReturnValue({
      width: 400,
      height: 0,
      top: 0,
      left: 0,
      bottom: 0,
      right: 400,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
    expect(isViewHeaderVisible(containerEl)).toBe(false)
  })

  it('returns true when header is visible with layout size', () => {
    const { containerEl, header } = makeHeaderTree()
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      display: 'flex',
      visibility: 'visible',
    } as CSSStyleDeclaration)
    vi.spyOn(header, 'getBoundingClientRect').mockReturnValue({
      width: 400,
      height: 40,
      top: 0,
      left: 0,
      bottom: 40,
      right: 400,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
    expect(isViewHeaderVisible(containerEl)).toBe(true)
  })
})
