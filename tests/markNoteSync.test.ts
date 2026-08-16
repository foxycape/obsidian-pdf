import { describe, expect, it, vi } from 'vitest'
import type { App, TFile } from 'obsidian'
import { buildMarkNoteAppendBlock, resolveSidecarNotePath } from '../src/obsidian/markNoteSync'
import type { Mark } from '@foxycape/core/kernal/mark/Mark'

describe('resolveSidecarNotePath', () => {
  it('uses same folder and basename as the PDF', () => {
    expect(
      resolveSidecarNotePath({
        basename: 'Book',
        parent: { path: 'Notes/PDF' },
      } as any),
    ).toBe('Notes/PDF/Book.md')
  })

  it('places root-level PDFs next to the vault root', () => {
    expect(
      resolveSidecarNotePath({
        basename: 'Book',
        parent: { path: '' },
      } as any),
    ).toBe('Book.md')
    expect(
      resolveSidecarNotePath({
        basename: 'Book',
        parent: { path: '/' },
      } as any),
    ).toBe('Book.md')
  })
})

describe('buildMarkNoteAppendBlock', () => {
  const mark = {
    markId: 'abc',
    pageNumber: 1,
    text: 'See **bold**',
  } as Mark

  it('writes a vault wikilink for local PDFs', () => {
    const generateMarkdownLink = vi.fn(
      (_file: TFile, _from: string, subpath: string, alias: string) =>
        `[[Book.pdf${subpath}|${alias}]]`,
    )
    const app = { fileManager: { generateMarkdownLink } } as unknown as App
    const pdfFile = { path: 'Book.pdf', basename: 'Book' } as TFile
    const noteFile = { path: 'Book.md' } as TFile

    expect(buildMarkNoteAppendBlock(app, { pdfFile }, noteFile, mark)).toBe(
      '\n> See \\*\\*bold\\*\\* [[Book.pdf#page=1&markId=abc|↗]]\n',
    )
  })

  it('writes a markdown URL link for remote PDFs', () => {
    const app = { fileManager: { generateMarkdownLink: vi.fn() } } as unknown as App
    const noteFile = { path: 'paper.md' } as TFile

    expect(
      buildMarkNoteAppendBlock(
        app,
        { sourceUrl: 'https://cdn.example.com/paper.pdf' },
        noteFile,
        mark,
      ),
    ).toBe('\n> See \\*\\*bold\\*\\* [↗](https://cdn.example.com/paper.pdf#page=1&markId=abc)\n')
  })
})
