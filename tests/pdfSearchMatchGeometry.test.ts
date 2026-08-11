import { describe, expect, it } from 'vitest'
import type { TextItem } from '@foxycape/core/pdfjs/types/src/display/api'
import {
  buildLayerText,
  buildShowTextSnippet,
  buildTextLayerMapping,
  convertMatches,
} from '../src/search/matchGeometry'

const item = (str: string, hasEOL = false): TextItem =>
  ({
    str,
    dir: 'ltr',
    width: 10,
    height: 10,
    transform: [1, 0, 0, 1, 0, 0],
    fontName: 'g_d0_f1',
    hasEOL,
  }) as TextItem

describe('buildTextLayerMapping', () => {
  it('keeps item.str sequence and records findText with EOL newlines', () => {
    const mapping = buildTextLayerMapping([item('Hello', true), item('World')])
    expect(mapping.texts).toEqual(['Hello', 'World'])
    expect(buildLayerText(mapping.texts)).toBe('HelloWorld')
    expect(mapping.findText).toBe('Hello\nWorld')
  })
})

describe('convertMatches', () => {
  it('maps pageMatches like TextHighlighter against texts join space', () => {
    // PDFFindController getOriginalIndex collapses hasEOL \\n so "World"
    // starts at 5 in layer space ("HelloWorld"), not 6 in findText.
    const texts = ['Hello', 'World']
    const [match] = convertMatches([5], [5], texts)
    expect(match.begin).toEqual({ divIdx: 1, offset: 0 })
    expect(match.end).toEqual({ divIdx: 1, offset: 5 })
  })

  it('supports matches spanning multiple text items', () => {
    const texts = ['ab', 'cd', 'ef']
    const [match] = convertMatches([1], [4], texts)
    expect(match.begin).toEqual({ divIdx: 0, offset: 1 })
    expect(match.end).toEqual({ divIdx: 2, offset: 1 })
  })
})

describe('buildShowTextSnippet', () => {
  it('escapes HTML and wraps the match', () => {
    const html = buildShowTextSnippet('aaa <b> match zzz', 8, 5, 'red')
    expect(html).toContain('&lt;b&gt;')
    expect(html).toContain('<span style="color:red">match</span>')
  })
})
