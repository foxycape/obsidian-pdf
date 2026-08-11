import { afterEach, describe, expect, it } from 'vitest'
import {
  PDF_IMAGE_REF_PENDING_TTL_MS,
  PDF_IMAGE_REF_SENTINEL_PREFIX,
  __setPendingPdfImageRefForTests,
  buildPdfImageAssetFileName,
  clearPendingPdfImageRef,
  consumePendingPdfImageRef,
  encodeMarkdownPath,
  formatClickablePdfImageMarkdown,
  formatScreenshotTimestamp,
  matchesPendingImageRefSentinel,
  pathRelativeToNote,
  peekPendingPdfImageRef,
  resolvePdfSiblingAssetFolder,
  sanitizeFileNamePart,
  type PendingPdfImageRef,
} from '../src/obsidian/pdfImageRef'
import type { TFile } from 'obsidian'

const makePdfFile = (path: string, basename: string): TFile =>
  ({
    path,
    basename,
    name: `${basename}.pdf`,
    extension: 'pdf',
    parent:
      path.includes('/')
        ? ({ path: path.slice(0, path.lastIndexOf('/')) } as TFile['parent'])
        : null,
  }) as TFile

afterEach(() => {
  clearPendingPdfImageRef()
})

describe('resolvePdfSiblingAssetFolder', () => {
  it('uses basename folder next to the PDF', () => {
    expect(resolvePdfSiblingAssetFolder(makePdfFile('Notes/PDF/Book.pdf', 'Book'))).toBe(
      'Notes/PDF/Book',
    )
  })

  it('supports vault-root PDFs', () => {
    expect(resolvePdfSiblingAssetFolder(makePdfFile('Book.pdf', 'Book'))).toBe('Book')
  })
})

describe('buildPdfImageAssetFileName', () => {
  it('builds embed names from page + hint', () => {
    expect(
      buildPdfImageAssetFileName({
        kind: 'embed',
        pageNumber: 3,
        nameHint: '123R',
      }),
    ).toBe('p3-123R.png')
  })

  it('sanitizes unsafe hint characters', () => {
    expect(
      buildPdfImageAssetFileName({
        kind: 'embed',
        pageNumber: 1,
        nameHint: 'img/../a b',
      }),
    ).toBe('p1-img_a_b.png')
  })

  it('builds screenshot names with timestamp', () => {
    const fixed = Date.UTC(2026, 7, 6, 2, 30, 45)
    expect(
      buildPdfImageAssetFileName({
        kind: 'screenshot',
        pageNumber: 12,
        now: () => fixed,
      }),
    ).toBe(`shot-p12-${formatScreenshotTimestamp(new Date(fixed))}.png`)
  })
})

describe('sanitizeFileNamePart', () => {
  it('falls back when empty', () => {
    expect(sanitizeFileNamePart('   ')).toBe('image')
  })
})

describe('pathRelativeToNote / markdown formatting', () => {
  it('computes relative paths from the note folder', () => {
    expect(pathRelativeToNote('Notes/PDF/memo.md', 'Notes/PDF/Book/p3-123R.png')).toBe(
      'Book/p3-123R.png',
    )
    expect(pathRelativeToNote('Inbox/a.md', 'Notes/PDF/Book.pdf')).toBe(
      '../Notes/PDF/Book.pdf',
    )
  })

  it('encodes path segments for markdown', () => {
    expect(encodeMarkdownPath('Book/My Image.png')).toBe('Book/My%20Image.png')
  })

  it('builds a clickable image markdown link with fragments on both sides', () => {
    expect(formatClickablePdfImageMarkdown('Book/p3-123R.png', 'Book.pdf', 3)).toBe(
      '[![](Book/p3-123R.png#page=3)](Book.pdf#page=3&name=p3-123R.png)',
    )
  })

  it('includes foxycape-rect and name on the PDF link', () => {
    expect(
      formatClickablePdfImageMarkdown(
        'Book/p3-123R.png',
        'Book.pdf',
        3,
        '55,101,251,237',
      ),
    ).toBe(
      '[![](Book/p3-123R.png#page=3&foxycape-rect=55,101,251,237)](Book.pdf#page=3&foxycape-rect=55,101,251,237&name=p3-123R.png)',
    )
  })
})

describe('pending image ref', () => {
  const samplePending = (stagedAt: number): PendingPdfImageRef => ({
    id: 'abc',
    pngBlob: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }),
    pdfFile: makePdfFile('Book.pdf', 'Book'),
    pageNumber: 2,
    kind: 'embed',
    nameHint: '1R',
    stagedAt,
  })

  it('peeks and consumes a staged payload', () => {
    const pending = samplePending(Date.now())
    __setPendingPdfImageRefForTests(pending)
    expect(peekPendingPdfImageRef()?.id).toBe('abc')
    expect(consumePendingPdfImageRef()?.id).toBe('abc')
    expect(peekPendingPdfImageRef()).toBeNull()
  })

  it('expires after TTL', () => {
    const now = Date.now()
    __setPendingPdfImageRefForTests(
      samplePending(now - PDF_IMAGE_REF_PENDING_TTL_MS - 1),
    )
    expect(peekPendingPdfImageRef(() => now)).toBeNull()
  })

  it('matches sentinel text', () => {
    const pending = samplePending(Date.now())
    __setPendingPdfImageRefForTests(pending)
    expect(
      matchesPendingImageRefSentinel(`${PDF_IMAGE_REF_SENTINEL_PREFIX}abc`, pending),
    ).toBe(true)
    expect(matchesPendingImageRefSentinel('hello', pending)).toBe(false)
  })
})
