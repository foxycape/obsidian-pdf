import { describe, expect, it, vi } from 'vitest'
import type { App, TFile, WorkspaceLeaf } from 'obsidian'
import {
  findExistingPdfLeaf,
  normalizePdfSubpath,
  resolvePdfLinkSubpath,
  revealExistingPdfLeaf,
} from '../src/obsidian/reusePdfLeaf'
import { PDF_READER_VIEW_TYPE } from '../src/settings/types'

const createLeaf = (
  path: string,
  activeTime = 0,
  options?: { viewType?: string; fileOnView?: boolean },
): WorkspaceLeaf => {
  const viewType = options?.viewType ?? PDF_READER_VIEW_TYPE
  const fileOnView = options?.fileOnView ?? true
  return {
    view: fileOnView ? { file: { path } } : {},
    activeTime,
    setEphemeralState: vi.fn(),
    getViewState: () => ({
      type: viewType,
      state: { file: path },
    }),
  } as unknown as WorkspaceLeaf
}

describe('findExistingPdfLeaf', () => {
  it('returns null when no matching leaf exists', () => {
    const app = {
      workspace: {
        getLeavesOfType: () => [],
        iterateAllLeaves: () => undefined,
      },
    } as unknown as App
    const file = { path: 'Books/a.pdf', extension: 'pdf' } as TFile

    expect(findExistingPdfLeaf(app, file)).toBeNull()
  })

  it('prefers the most recently active matching leaf', () => {
    const older = createLeaf('Books/a.pdf', 10)
    const newer = createLeaf('Books/a.pdf', 99)
    const other = createLeaf('Books/b.pdf', 1000)
    const app = {
      workspace: {
        getLeavesOfType: (type: string) =>
          type === PDF_READER_VIEW_TYPE ? [older, other, newer] : [],
        iterateAllLeaves: (cb: (leaf: WorkspaceLeaf) => void) => {
          ;[older, other, newer].forEach(cb)
        },
      },
    } as unknown as App
    const file = { path: 'Books/a.pdf', extension: 'pdf' } as TFile

    expect(findExistingPdfLeaf(app, file, [PDF_READER_VIEW_TYPE])).toBe(newer)
  })

  it('finds a remote URL tab from view state', () => {
    const url = 'https://cdn.example.com/paper.pdf'
    const remote = {
      view: {},
      activeTime: 20,
      setEphemeralState: vi.fn(),
      getViewState: () => ({
        type: PDF_READER_VIEW_TYPE,
        state: { url },
      }),
    } as unknown as WorkspaceLeaf
    const app = {
      workspace: {
        getLeavesOfType: () => [remote],
        iterateAllLeaves: (cb: (leaf: WorkspaceLeaf) => void) => {
          cb(remote)
        },
      },
    } as unknown as App

    expect(findExistingPdfLeaf(app, { url }, [PDF_READER_VIEW_TYPE])).toBe(remote)
  })

  it('finds deferred tabs that only expose the file path on view state', () => {
    const deferred = createLeaf('Books/a.pdf', 50, { fileOnView: false })
    const app = {
      workspace: {
        getLeavesOfType: () => [deferred],
        iterateAllLeaves: (cb: (leaf: WorkspaceLeaf) => void) => {
          cb(deferred)
        },
      },
    } as unknown as App
    const file = { path: 'Books/a.pdf', extension: 'pdf' } as TFile

    expect(findExistingPdfLeaf(app, file, [PDF_READER_VIEW_TYPE])).toBe(deferred)
  })
})

describe('revealExistingPdfLeaf', () => {
  it('reveals the leaf and applies subpath ephemeral state', async () => {
    const leaf = createLeaf('Books/a.pdf')
    const revealLeaf = vi.fn()
    const setActiveLeaf = vi.fn()
    const app = {
      workspace: {
        revealLeaf,
        setActiveLeaf,
      },
    } as unknown as App

    await revealExistingPdfLeaf(app, leaf, undefined, 'page=3')

    expect(revealLeaf).toHaveBeenCalledWith(leaf)
    expect(setActiveLeaf).toHaveBeenCalledWith(leaf, { focus: true })
    expect(leaf.setEphemeralState).toHaveBeenCalledWith({ subpath: '#page=3' })
  })
})

describe('resolvePdfLinkSubpath', () => {
  it('returns the subpath when linktext resolves to the target PDF', () => {
    const file = { path: 'Books/a.pdf', extension: 'pdf' } as TFile
    const app = {
      metadataCache: {
        getFirstLinkpathDest: (path: string) =>
          path === 'Books/a.pdf' || path === 'a.pdf' ? file : null,
      },
    } as unknown as App

    expect(
      resolvePdfLinkSubpath(
        app,
        file,
        'a.pdf#page=12&selection=1,2,3,4&markId=abc',
        'Notes/note.md',
      ),
    ).toBe('#page=12&selection=1,2,3,4&markId=abc')
  })

  it('returns undefined when the link has no subpath', () => {
    const file = { path: 'Books/a.pdf', extension: 'pdf' } as TFile
    const app = {
      metadataCache: {
        getFirstLinkpathDest: () => file,
      },
    } as unknown as App

    expect(resolvePdfLinkSubpath(app, file, 'a.pdf', 'Notes/note.md')).toBeUndefined()
  })
})

describe('normalizePdfSubpath', () => {
  it('adds a leading hash when missing', () => {
    expect(normalizePdfSubpath('page=2')).toBe('#page=2')
    expect(normalizePdfSubpath('#page=2')).toBe('#page=2')
    expect(normalizePdfSubpath('')).toBeUndefined()
  })
})
