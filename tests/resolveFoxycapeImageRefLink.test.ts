import { describe, expect, it } from 'vitest'
import type { App, TFile } from 'obsidian'
import {
  findFirstAncestorWithSrc,
  imageFileNameFromPath,
  resolveFoxycapeImageRefFromImageElement,
  resolveFoxycapeImageRefLink,
} from '../src/obsidian/resolveFoxycapeImageRefLink'

const makePdf = (path: string): TFile =>
  ({
    path,
    basename: path.replace(/\.pdf$/i, '').split('/').pop() ?? path,
    extension: 'pdf',
    name: path.split('/').pop() ?? path,
  }) as TFile

describe('resolveFoxycapeImageRefLink', () => {
  const pdf = makePdf('Notes/Book.pdf')
  const app = {
    metadataCache: {
      getFirstLinkpathDest: (path: string) =>
        path === 'Book.pdf' || path === 'Notes/Book.pdf' ? pdf : null,
    },
  } as unknown as App

  it('resolves foxycape-rect image location links', () => {
    expect(
      resolveFoxycapeImageRefLink(
        app,
        'Book.pdf#page=3&foxycape-rect=55,101,251,237',
        'Notes/memo.md',
      ),
    ).toEqual({
      pdfFile: pdf,
      subpath: '#page=3&foxycape-rect=55,101,251,237',
    })
  })

  it('strips name= from the navigable subpath', () => {
    expect(
      resolveFoxycapeImageRefLink(
        app,
        'Book.pdf#page=3&foxycape-rect=55,101,251,237&name=p3-123R.png',
        'Notes/memo.md',
        { imageFileName: 'p3-123R.png' },
      ),
    ).toEqual({
      pdfFile: pdf,
      subpath: '#page=3&foxycape-rect=55,101,251,237',
    })
  })

  it('rejects when name= does not match the image file', () => {
    expect(
      resolveFoxycapeImageRefLink(
        app,
        'Book.pdf#page=3&foxycape-rect=55,101,251,237&name=other.png',
        'Notes/memo.md',
        { imageFileName: 'p3-123R.png' },
      ),
    ).toBeNull()
  })

  it('rejects when name= is required but missing', () => {
    expect(
      resolveFoxycapeImageRefLink(
        app,
        'Book.pdf#page=3&foxycape-rect=55,101,251,237',
        'Notes/memo.md',
        { imageFileName: 'p3-123R.png' },
      ),
    ).toBeNull()
  })

  it('normalizes legacy rect= to foxycape-rect for navigation', () => {
    expect(
      resolveFoxycapeImageRefLink(
        app,
        'Book.pdf#page=3&rect=55,101,251,237',
        'Notes/memo.md',
      ),
    ).toEqual({
      pdfFile: pdf,
      subpath: '#page=3&foxycape-rect=55,101,251,237',
    })
  })

  it('rejects page-only PDF links', () => {
    expect(
      resolveFoxycapeImageRefLink(app, 'Book.pdf#page=3', 'Notes/memo.md'),
    ).toBeNull()
  })

  it('rejects non-PDF targets', () => {
    expect(
      resolveFoxycapeImageRefLink(
        app,
        'note.md#page=3&foxycape-rect=1,2,3,4',
        'Notes/memo.md',
      ),
    ).toBeNull()
  })
})

describe('imageFileNameFromPath', () => {
  it('strips fragment and decodes the basename', () => {
    expect(
      imageFileNameFromPath(
        'Book/p103-934R.png#page=103&foxycape-rect=1,2,3,4',
      ),
    ).toBe('p103-934R.png')
    expect(imageFileNameFromPath('folder/My%20Image.png|100')).toBe('My Image.png')
  })
})

describe('resolveFoxycapeImageRefFromImageElement', () => {
  const pdf = makePdf('Notes/Book.pdf')
  const app = {
    metadataCache: {
      getFirstLinkpathDest: (path: string) =>
        path === 'Book.pdf' || path === 'Notes/Book.pdf' ? pdf : null,
    },
  } as unknown as App

  it('uses the first ancestor with src and matches name=', () => {
    const root = document.createElement('div')
    root.innerHTML = `
      <div src="Book.pdf#page=103&foxycape-rect=55.369,62.418,456.189,281.479&name=p103-934R.png">
        <img src="Book/p103-934R.png#page=103&foxycape-rect=55.369,62.418,456.189,281.479" />
      </div>
    `
    const img = root.querySelector('img')
    expect(img).toBeTruthy()
    expect(findFirstAncestorWithSrc(img!)?.getAttribute('src')).toContain(
      'Book.pdf#page=103',
    )
    expect(
      resolveFoxycapeImageRefFromImageElement(app, img!, 'Notes/memo.md'),
    ).toEqual({
      pdfFile: pdf,
      subpath: '#page=103&foxycape-rect=55.369,62.418,456.189,281.479',
    })
  })

  it('stops at the first src ancestor even when it is not a matching PDF link', () => {
    const root = document.createElement('div')
    root.innerHTML = `
      <div src="Book.pdf#page=103&foxycape-rect=55,101,251,237&name=p103-934R.png">
        <span src="not-a-pdf.png">
          <img src="Book/p103-934R.png#page=103&foxycape-rect=55,101,251,237" />
        </span>
      </div>
    `
    const img = root.querySelector('img')
    expect(
      resolveFoxycapeImageRefFromImageElement(app, img!, 'Notes/memo.md'),
    ).toBeNull()
  })
})
