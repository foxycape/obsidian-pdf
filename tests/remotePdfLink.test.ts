import { describe, expect, it, vi } from 'vitest'
import type { App, TFile } from 'obsidian'
import {
  buildPdfMarkdownLink,
  displayNameFromRemotePdfUrl,
  fileNameFromRemotePdfUrl,
  formatRemotePdfMarkdownLink,
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
})

describe('fileNameFromRemotePdfUrl', () => {
  it('reads the basename from the path', () => {
    expect(fileNameFromRemotePdfUrl(remoteHref)).toBe('1671-167X(2014)04-0657-02.pdf')
    expect(displayNameFromRemotePdfUrl(remoteHref)).toBe('1671-167X(2014)04-0657-02')
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
