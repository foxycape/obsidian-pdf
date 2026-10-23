import { describe, expect, it } from 'vitest'
import { resolveLocaleCode } from '../src/i18n/resolveObsidianLanguage'

const shipped = ['en', 'pt', 'pt-BR', 'zh', 'zh-TW']

describe('resolveLocaleCode', () => {
  it('maps English variants to en-us when that code exists, otherwise en', () => {
    expect(resolveLocaleCode('en-GB', ['en-us', 'pt-pt', 'pt-br'])).toBe('en-us')
    expect(resolveLocaleCode('en-us', ['en-us', 'pt'])).toBe('en-us')
    expect(resolveLocaleCode('en-GB', shipped)).toBe('en')
    expect(resolveLocaleCode('en', shipped)).toBe('en')
  })

  it('keeps Brazilian Portuguese and prefers pt-pt for other Portuguese tags', () => {
    expect(resolveLocaleCode('pt-BR', ['en-us', 'pt-pt', 'pt-br'])).toBe('pt-br')
    expect(resolveLocaleCode('pt-br', shipped)).toBe('pt-BR')
    expect(resolveLocaleCode('pt-PT', ['en-us', 'pt-pt', 'pt-br'])).toBe('pt-pt')
    expect(resolveLocaleCode('pt-PT', shipped)).toBe('pt')
    expect(resolveLocaleCode('pt', shipped)).toBe('pt')
    expect(resolveLocaleCode('pt-AO', ['pt-br', 'pt-pt'])).toBe('pt-pt')
  })
})
