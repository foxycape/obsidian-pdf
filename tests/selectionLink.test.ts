import { describe, expect, it } from 'vitest'
import {
  buildPdfDeepLinkFragment,
  buildPdfUserSpaceRectParam,
  escapeMarkdownText,
  formatMarkQuoteLine,
  formatRectTuple,
  parsePdfDeepLink,
  parseRectTuple,
  parseSelectionTuple,
  toNavigablePdfSubpath,
} from '../src/obsidian/selectionLink'

describe('buildPdfDeepLinkFragment', () => {
  it('includes page, selection, and markId', () => {
    expect(
      buildPdfDeepLinkFragment({
        pageNumber: 341,
        selection: '14,17,14,27',
        markId: 'abc123',
      }),
    ).toBe('#page=341&selection=14,17,14,27&markId=abc123')
  })

  it('omits selection when missing but keeps markId', () => {
    expect(
      buildPdfDeepLinkFragment({
        pageNumber: 2,
        markId: 'deadbeef',
      }),
    ).toBe('#page=2&markId=deadbeef')
  })

  it('supports selection-only links without markId', () => {
    expect(
      buildPdfDeepLinkFragment({
        pageNumber: 3,
        selection: '1,0,1,5',
      }),
    ).toBe('#page=3&selection=1,0,1,5')
  })

  it('includes foxycape-rect in PDF user-space form', () => {
    expect(
      buildPdfDeepLinkFragment({
        pageNumber: 3,
        rect: '55,101,251,237',
      }),
    ).toBe('#page=3&foxycape-rect=55,101,251,237')
  })

  it('includes encoded name= for image binding', () => {
    expect(
      buildPdfDeepLinkFragment({
        pageNumber: 3,
        rect: '55,101,251,237',
        name: 'p3 123R.png',
      }),
    ).toBe('#page=3&foxycape-rect=55,101,251,237&name=p3%20123R.png')
  })
})

describe('parsePdfDeepLink', () => {
  it('parses Obsidian-compatible fragment with markId', () => {
    expect(
      parsePdfDeepLink('#page=341&selection=14,17,14,27&markId=abc123'),
    ).toEqual({
      page: 341,
      selection: '14,17,14,27',
      markId: 'abc123',
      rect: undefined,
      name: undefined,
    })
  })

  it('accepts fragment without leading hash', () => {
    expect(parsePdfDeepLink('page=3&markId=ff')).toEqual({
      page: 3,
      selection: undefined,
      markId: 'ff',
      rect: undefined,
      name: undefined,
    })
  })

  it('parses foxycape-rect parameter', () => {
    expect(parsePdfDeepLink('#page=3&foxycape-rect=55,101,251,237')).toEqual({
      page: 3,
      selection: undefined,
      markId: undefined,
      rect: '55,101,251,237',
      name: undefined,
    })
  })

  it('accepts legacy rect= with the same user-space semantics', () => {
    expect(parsePdfDeepLink('#page=3&rect=55,101,251,237')).toEqual({
      page: 3,
      selection: undefined,
      markId: undefined,
      rect: '55,101,251,237',
      name: undefined,
    })
  })

  it('prefers foxycape-rect when both keys are present', () => {
    expect(
      parsePdfDeepLink('#page=3&rect=1,2,3,4&foxycape-rect=55,101,251,237'),
    ).toEqual({
      page: 3,
      selection: undefined,
      markId: undefined,
      rect: '55,101,251,237',
      name: undefined,
    })
  })

  it('parses name= image binding', () => {
    expect(
      parsePdfDeepLink(
        '#page=3&foxycape-rect=55,101,251,237&name=p3%20123R.png',
      ),
    ).toEqual({
      page: 3,
      selection: undefined,
      markId: undefined,
      rect: '55,101,251,237',
      name: 'p3 123R.png',
    })
  })

  it('strips name= for navigation', () => {
    expect(
      toNavigablePdfSubpath(
        '#page=3&foxycape-rect=55,101,251,237&name=p3-123R.png',
      ),
    ).toBe('#page=3&foxycape-rect=55,101,251,237')
  })

  it('drops invalid foxycape-rect', () => {
    expect(parsePdfDeepLink('#page=3&foxycape-rect=1,2,3')).toEqual({
      page: 3,
      selection: undefined,
      markId: undefined,
      rect: undefined,
    })
  })
})

describe('parseSelectionTuple', () => {
  it('parses four integers', () => {
    expect(parseSelectionTuple('14,17,14,27')).toEqual([14, 17, 14, 27])
  })

  it('rejects invalid values', () => {
    expect(parseSelectionTuple('1,2,3')).toBeUndefined()
    expect(parseSelectionTuple(undefined)).toBeUndefined()
  })
})

describe('rect helpers', () => {
  it('formats and parses PDF user-space rect tuples', () => {
    expect(
      formatRectTuple({ x1: 55, y1: 101, x2: 251, y2: 237 }),
    ).toBe('55,101,251,237')
    expect(parseRectTuple('55,101,251,237')).toEqual([55, 101, 251, 237])
    // y2 must be above y1 in PDF space
    expect(parseRectTuple('55,237,251,101')).toBeUndefined()
  })

  it('builds PDF user-space rect from canvas box (Y flipped)', () => {
    // canvas 1000x2000, page 500x1000; box at canvas (100,200)-(400,600)
    // => PDF x1=50, x2=200; y2=1000-100=900; y1=1000-300=700
    expect(
      buildPdfUserSpaceRectParam({
        x: 100,
        y: 200,
        width: 300,
        height: 400,
        canvasWidth: 1000,
        canvasHeight: 2000,
        pageOriginWidth: 500,
        pageOriginHeight: 1000,
      }),
    ).toBe('50,700,200,900')
  })
})

describe('formatMarkQuoteLine', () => {
  it('builds a blockquote with source link', () => {
    expect(formatMarkQuoteLine('hello\nworld', '[[Book.pdf#page=1&markId=x|↗]]')).toBe(
      '> hello world [[Book.pdf#page=1&markId=x|↗]]',
    )
  })

  it('escapes markdown syntax in the quote text', () => {
    expect(
      formatMarkQuoteLine('See **bold**, _em_, #tag and [[Note]]', '[[Book.pdf#page=1]]'),
    ).toBe('> See \\*\\*bold\\*\\*, \\_em\\_, \\#tag and \\[\\[Note\\]\\] [[Book.pdf#page=1]]')
  })

  it('escapes backticks, highlight, math, and html', () => {
    expect(formatMarkQuoteLine('use `x` ==hi== $a$ <b>', '[[Book.pdf]]')).toBe(
      '> use \\`x\\` \\=\\=hi\\=\\= \\$a\\$ \\<b> [[Book.pdf]]',
    )
  })

  it('escapes a leading list marker so the quote stays a paragraph', () => {
    expect(formatMarkQuoteLine('- item', '[[Book.pdf]]')).toBe('> \\- item [[Book.pdf]]')
    expect(formatMarkQuoteLine('1. item', '[[Book.pdf]]')).toBe('> 1\\. item [[Book.pdf]]')
  })
})

describe('escapeMarkdownText', () => {
  it('escapes inline syntax without collapsing whitespace', () => {
    expect(escapeMarkdownText('See **bold** and #tag')).toBe('See \\*\\*bold\\*\\* and \\#tag')
  })

  it('escapes a list marker on every line', () => {
    expect(escapeMarkdownText('- one\n1. two\nplain')).toBe('\\- one\n1\\. two\nplain')
  })
})
