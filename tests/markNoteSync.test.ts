import { describe, expect, it } from 'vitest'
import { resolveSidecarNotePath } from '../src/obsidian/markNoteSync'

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
