import { MarkdownView, Notice, TFile, type App, type WorkspaceLeaf } from 'obsidian'
import type { Mark } from '@foxycape/core/kernal/mark/Mark'
import {
  buildPdfDeepLinkFragment,
  formatMarkQuoteLine,
} from './selectionLink'

export type MarkNoteSyncOptions = {
  app: App
  pdfFile: TFile
  mark: Mark
  selection?: string
  t: (key: string, fallback: string, vars?: Record<string, string | number>) => string
}

const isLeafAlive = (app: App, leaf: WorkspaceLeaf): boolean => {
  let alive = false
  app.workspace.iterateAllLeaves((candidate) => {
    if (candidate === leaf) {
      alive = true
    }
  })
  return alive
}

/** Tracks the companion markdown split leaf for one PDF view session. */
export class MarkNoteCompanion {
  private companionLeaf: WorkspaceLeaf | null = null
  private dismissed = false

  reset() {
    this.companionLeaf = null
    this.dismissed = false
  }

  /**
   * After appending to the sidecar note: open/reveal in split, or stay silent
   * once the user has closed that companion leaf.
   */
  async revealOrOpen(app: App, noteFile: TFile): Promise<void> {
    if (this.dismissed) {
      return
    }

    if (this.companionLeaf) {
      if (!isLeafAlive(app, this.companionLeaf)) {
        this.dismissed = true
        this.companionLeaf = null
        return
      }
      const view = this.companionLeaf.view
      const openFile = view instanceof MarkdownView ? view.file : null
      if (openFile?.path === noteFile.path) {
        void app.workspace.revealLeaf(this.companionLeaf)
        return
      }
      // Leaf reused for another file — treat as dismissed for this session.
      this.dismissed = true
      this.companionLeaf = null
      return
    }

    const leaf = app.workspace.getLeaf('split')
    await leaf.openFile(noteFile, { active: true })
    this.companionLeaf = leaf
  }

  /** Optional: call when workspace layout changes to detect closed companion early. */
  onLayoutChange(app: App) {
    if (!this.companionLeaf || this.dismissed) {
      return
    }
    if (!isLeafAlive(app, this.companionLeaf)) {
      this.dismissed = true
      this.companionLeaf = null
    }
  }
}

export const resolveSidecarNotePath = (pdfFile: TFile): string => {
  const parent = pdfFile.parent
  if (!parent || parent.path === '/' || parent.path === '') {
    return `${pdfFile.basename}.md`
  }
  return `${parent.path}/${pdfFile.basename}.md`
}

export const ensureSidecarNote = async (app: App, pdfFile: TFile): Promise<TFile> => {
  const notePath = resolveSidecarNotePath(pdfFile)
  const existing = app.vault.getAbstractFileByPath(notePath)
  if (existing instanceof TFile) {
    return existing
  }
  if (existing) {
    throw new Error(`Sidecar path is not a file: ${notePath}`)
  }
  return app.vault.create(notePath, '')
}

export const buildMarkNoteAppendBlock = (
  app: App,
  pdfFile: TFile,
  noteFile: TFile,
  mark: Mark,
  selection?: string,
): string => {
  const pageNumber = mark.pageNumber
  const subpath = buildPdfDeepLinkFragment({
    pageNumber,
    selection,
    markId: mark.markId,
  })
  const link = app.fileManager.generateMarkdownLink(pdfFile, noteFile.path, subpath, '↗')
  return `\n${formatMarkQuoteLine(mark.text || '', link)}\n`
}

/**
 * Create/append sidecar markdown for a newly created mark, then manage companion leaf.
 */
export const syncMarkToSidecarNote = async (
  options: MarkNoteSyncOptions,
  companion: MarkNoteCompanion,
): Promise<TFile | null> => {
  const { app, pdfFile, mark, selection, t } = options
  try {
    const noteFile = await ensureSidecarNote(app, pdfFile)
    const block = buildMarkNoteAppendBlock(app, pdfFile, noteFile, mark, selection)
    await app.vault.append(noteFile, block)
    await companion.revealOrOpen(app, noteFile)
    return noteFile
  } catch (error) {
    console.error('[Foxycape PDF] failed to sync mark to note', error)
    const message = error instanceof Error ? error.message : String(error)
    new Notice(
      t('plugin_notice_mark_note_sync_failed', 'Failed to write highlight note: {message}', {
        message,
      }),
    )
    return null
  }
}
