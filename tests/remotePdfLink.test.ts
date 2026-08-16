import { describe, expect, it, vi } from 'vitest'
import type { App, TFile } from 'obsidian'
import {
  buildPdfMarkdownLink,
  displayNameFromRemotePdfUrl,
  fileNameFromRemotePdfUrl,
  formatRemotePdfMarkdownLink,
  normalizeRemoteDocumentUrl,
  parseGoogleDriveShareHref,
  parseRemoteContextMenuHref,
  parseRemotePdfHref,
  resolveRemoteSidecarNotePath,
} from '../src/obsidian/remotePdfLink'

const remoteHref =
  'https://cdn.linghuxiong.com/files/1671-167X(2014)04-0657-02.pdf#page=1&selection=417,0,476,0&markId=7be43b26c4c23a92'

describe('parseRemotePdfHref', () => {
  it('keeps the document URL and splits the deep-link hash', () => {
    expect(parseRemotePdfHref(remoteHref)).toEqual({
      url: 'https://cdn.linghuxiong.com/files/1671-167X(2014)04-0657-02.pdf',
      subpath: '#page=1&selection=417,0,476,0&markId=7be43b26c4c23a92',
    })
  })

  it('rejects non-pdf and non-http targets', () => {
    expect(parseRemotePdfHref('https://example.com/notes.md')).toBeNull()
    expect(parseRemotePdfHref('[[Book.pdf]]')).toBeNull()
    expect(parseRemotePdfHref('app://local/Book.pdf')).toBeNull()
  })

  it('does not treat Google Drive share links as clickable remote PDFs', () => {
    expect(
      parseRemotePdfHref(
        'https://drive.google.com/file/d/19ZEB_jP80PT0pnRgS1c_qJSgNp9fS2Bt/view?usp=sharing',
      ),
    ).toBeNull()
  })
})

describe('parseGoogleDriveShareHref', () => {
  const shareHref =
    'https://drive.google.com/file/d/19ZEB_jP80PT0pnRgS1c_qJSgNp9fS2Bt/view?usp=sharing'
  const downloadHref =
    'https://drive.google.com/uc?export=download&id=19ZEB_jP80PT0pnRgS1c_qJSgNp9fS2Bt'

  it('converts a sharing view link to the download URL', () => {
    expect(parseGoogleDriveShareHref(shareHref)).toEqual({
      url: downloadHref,
    })
  })

  it('keeps a deep-link hash as subpath', () => {
    expect(parseGoogleDriveShareHref(`${shareHref}#page=3`)).toEqual({
      url: downloadHref,
      subpath: '#page=3',
    })
  })

  it('rejects Drive links without usp=sharing', () => {
    expect(
      parseGoogleDriveShareHref(
        'https://drive.google.com/file/d/19ZEB_jP80PT0pnRgS1c_qJSgNp9fS2Bt/view',
      ),
    ).toBeNull()
  })
})

describe('parseRemoteContextMenuHref', () => {
  it('accepts remote PDFs and Google Drive share links', () => {
    expect(parseRemoteContextMenuHref(remoteHref)?.url).toBe(
      'https://cdn.linghuxiong.com/files/1671-167X(2014)04-0657-02.pdf',
    )
    expect(
      parseRemoteContextMenuHref(
        'https://drive.google.com/file/d/19ZEB_jP80PT0pnRgS1c_qJSgNp9fS2Bt/view?usp=sharing',
      )?.url,
    ).toBe('https://drive.google.com/uc?export=download&id=19ZEB_jP80PT0pnRgS1c_qJSgNp9fS2Bt')
  })
})

describe('normalizeRemoteDocumentUrl', () => {
  it('accepts already-converted Google Drive download URLs', () => {
    expect(
      normalizeRemoteDocumentUrl(
        'https://drive.google.com/uc?export=download&id=19ZEB_jP80PT0pnRgS1c_qJSgNp9fS2Bt',
      ),
    ).toBe('https://drive.google.com/uc?export=download&id=19ZEB_jP80PT0pnRgS1c_qJSgNp9fS2Bt')
  })
})

describe('fileNameFromRemotePdfUrl', () => {
  it('reads the basename from the path', () => {
    expect(fileNameFromRemotePdfUrl(remoteHref)).toBe('1671-167X(2014)04-0657-02.pdf')
    expect(displayNameFromRemotePdfUrl(remoteHref)).toBe('1671-167X(2014)04-0657-02')
  })

  it('uses the Google Drive file id when the path has no .pdf suffix', () => {
    expect(
      fileNameFromRemotePdfUrl(
        'https://drive.google.com/uc?export=download&id=19ZEB_jP80PT0pnRgS1c_qJSgNp9fS2Bt',
      ),
    ).toBe('19ZEB_jP80PT0pnRgS1c_qJSgNp9fS2Bt.pdf')
  })
})

describe('resolveRemoteSidecarNotePath', () => {
  it('uses a sanitized basename at the vault root', () => {
    expect(resolveRemoteSidecarNotePath(remoteHref)).toBe('1671-167X_2014_04-0657-02.md')
  })
})

describe('formatRemotePdfMarkdownLink', () => {
  it('uses a markdown link, not a wikilink', () => {
    const link = formatRemotePdfMarkdownLink(
      'https://cdn.linghuxiong.com/files/1671-167X(2014)04-0657-02.pdf',
      '#page=1&markId=abc',
    )
    expect(link.startsWith('[[')).toBe(false)
    expect(link).toBe(
      '[↗](<https://cdn.linghuxiong.com/files/1671-167X(2014)04-0657-02.pdf#page=1&markId=abc>)',
    )
  })

  it('omits angle brackets when the URL has no markdown-breaking characters', () => {
    expect(
      formatRemotePdfMarkdownLink('https://cdn.example.com/book.pdf', '#page=2'),
    ).toBe('[↗](https://cdn.example.com/book.pdf#page=2)')
  })
})

describe('buildPdfMarkdownLink', () => {
  it('prefers the remote URL over a vault file', () => {
    const generateMarkdownLink = vi.fn()
    const app = { fileManager: { generateMarkdownLink } } as unknown as App
    const pdfFile = { path: 'Book.pdf' } as TFile

    expect(
      buildPdfMarkdownLink(
        { app, pdfFile, sourceUrl: 'https://cdn.example.com/book.pdf' },
        '#page=1',
      ),
    ).toBe('[↗](https://cdn.example.com/book.pdf#page=1)')
    expect(generateMarkdownLink).not.toHaveBeenCalled()
  })
})
