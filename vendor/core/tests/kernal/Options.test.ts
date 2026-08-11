import { describe, expect, it } from 'vitest'
import { Options } from '@/kernal/Options'
import { OptionsProvider } from '@/kernal/OptionsProvider'

const createProvider = (partial: Partial<Options> = {}) => {
  const options = Object.assign(new Options(), partial)
  return new OptionsProvider(null as any, options)
}

describe('OptionsProvider', () => {
  it('returns default header height when enabled and height is invalid', () => {
    const provider = createProvider({
      enableHeader: true,
      zenMode: false,
      headerHeight: 0,
      defaultHeaderHeight: 40
    })
    expect(provider.getHeaderHeight()).toBe(40)
  })

  it('returns 0 for header height in zen mode', () => {
    const provider = createProvider({
      enableHeader: true,
      zenMode: true,
      headerHeight: 48
    })
    expect(provider.getHeaderHeight()).toBe(0)
  })

  it('returns default footer height when enabled and height is invalid', () => {
    const provider = createProvider({
      enableFooter: true,
      zenMode: false,
      footerHeight: 0,
      defaultFooterHeight: 30
    })
    expect(provider.getFooterHeight()).toBe(30)
  })

  it('returns 0 for footer height in zen mode', () => {
    const provider = createProvider({
      enableFooter: true,
      zenMode: true,
      footerHeight: 36
    })
    expect(provider.getFooterHeight()).toBe(0)
  })
})
