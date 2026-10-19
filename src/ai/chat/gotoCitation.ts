import type { Reader } from '@foxycape/core/kernal'
import { TFile, type App, type WorkspaceLeaf } from 'obsidian'
import { getPdfRenderer } from '@/chrome/usePdfRenderer'
import { flashPassageText } from '@/marker/flashPassageText'
import { highlightPdfPageTextOffset } from '@/obsidian/pageTextHighlight'
import { revealExistingPdfLeaf } from '@/obsidian/reusePdfLeaf'
import { buildPdfDeepLinkFragment } from '@/obsidian/selectionLink'
import { PDF_READER_VIEW_TYPE } from '@/settings/types'
import type { DexieStorage } from '@/storage/DexieStorage'
import { listPdfChats } from './chatService'
import type { DocumentCitation } from './types'

export type PdfCitationOpener = {
  app: App
  openFile: (file: TFile, subpath?: string) => Promise<void>
  openUrl: (url: string, subpath?: string) => Promise<void>
}

export type CitationJumpResult = { ok: true } | { ok: false; title: string }

const READER_WAIT_ATTEMPTS = 40
const READER_WAIT_MS = 150

type OpenReader = {
  reader: Reader
  leaf: WorkspaceLeaf
}

const readerId = (reader: Reader | null | undefined) => reader?.context?.id ?? ''

const readerOnLeaf = (leaf: WorkspaceLeaf): Reader | null => {
  const view = leaf.view as { getReader?: () => Reader | null } | null
  if (!view || typeof view.getReader !== 'function') {
    return null
  }
  try {
    return view.getReader() ?? null
  } catch {
    return null
  }
}

const leafViewType = (leaf: WorkspaceLeaf) => {
  try {
    return leaf.getViewState()?.type
  } catch {
    return undefined
  }
}

const matchLeaf = (leaf: WorkspaceLeaf, simpleId: string): OpenReader | null => {
  if (leafViewType(leaf) !== PDF_READER_VIEW_TYPE) {
    return null
  }
  const reader = readerOnLeaf(leaf)
  if (!reader || readerId(reader) !== simpleId) {
    return null
  }
  return { reader, leaf }
}

export const findOpenPdfReader = (app: App, simpleId: string): OpenReader | null => {
  if (!simpleId) {
    return null
  }
  const active = app.workspace.activeLeaf
  if (active) {
    const current = matchLeaf(active, simpleId)
    if (current) {
      return current
    }
  }
  let found: OpenReader | null = null
  app.workspace.iterateAllLeaves((leaf) => {
    if (found) {
      return
    }
    found = matchLeaf(leaf, simpleId)
  })
  return found
}

const waitForPdfReader = async (app: App, simpleId: string) => {
  for (let attempt = 0; attempt < READER_WAIT_ATTEMPTS; attempt += 1) {
    const opened = findOpenPdfReader(app, simpleId)
    if (opened) {
      return opened
    }
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, READER_WAIT_MS)
    })
  }
  return null
}

const flashCitation = async (reader: Reader, citation: DocumentCitation) => {
  const renderer = getPdfRenderer(reader)
  const pageNumber = citation.pageNumber ?? 0
  const start = citation.startTextOffset
  const end = citation.endTextOffset
  if (renderer && pageNumber > 0 && start != null && end != null && end > start) {
    const located = await highlightPdfPageTextOffset(
      renderer,
      pageNumber,
      `${Math.floor(start)},${Math.floor(end)}`,
      citation.snippet,
    )
    if (!located) {
      renderer.setCurrentPage(pageNumber, true)
    }
    return
  }
  const found = await flashPassageText(renderer, pageNumber, citation.snippet ?? '')
  if (!found && renderer && pageNumber > 0) {
    renderer.setCurrentPage(pageNumber, true)
  }
}

const pageSubpath = (citation: DocumentCitation) => {
  const pageNumber = citation.pageNumber
  if (!pageNumber || pageNumber < 1) {
    return undefined
  }
  const start = citation.startTextOffset
  const end = citation.endTextOffset
  const textOffset =
    start != null && end != null && end > start
      ? `${Math.floor(start)},${Math.floor(end)}`
      : undefined
  return buildPdfDeepLinkFragment({ pageNumber, textOffset })
}

const resolveCitationTarget = async (
  storage: DexieStorage,
  app: App,
  citation: DocumentCitation,
): Promise<{ file?: TFile; url?: string; title: string }> => {
  const chats = citation.simpleId ? await listPdfChats(storage, citation.simpleId) : []
  const title =
    chats.find((item) => item.pdfTitle?.trim())?.pdfTitle?.trim() ||
    citation.resourceTitle?.trim() ||
    citation.simpleId
  const filePath = chats.find((item) => item.filePath?.trim())?.filePath?.trim()
  if (filePath) {
    const file = app.vault.getAbstractFileByPath(filePath)
    if (file instanceof TFile) {
      return { file, title: title || file.basename }
    }
  }
  const sourceUrl = chats.find((item) => item.sourceUrl?.trim())?.sourceUrl?.trim()
  if (sourceUrl) {
    return { url: sourceUrl, title }
  }
  const pdfTitle = chats.find((item) => item.pdfTitle?.trim())?.pdfTitle?.trim()
  if (pdfTitle) {
    const matches = app.vault
      .getFiles()
      .filter((file) => file.extension.toLowerCase() === 'pdf' && file.basename === pdfTitle)
    if (matches.length === 1) {
      return { file: matches[0], title: pdfTitle }
    }
  }
  return { title }
}

export const jumpToPdfCitation = async (input: {
  citation: DocumentCitation
  currentReader: Reader
  storage: DexieStorage
  opener: PdfCitationOpener
}): Promise<CitationJumpResult> => {
  const { citation, currentReader, opener } = input
  const simpleId = citation.simpleId
  if (!simpleId || simpleId === readerId(currentReader)) {
    await flashCitation(currentReader, citation)
    return { ok: true }
  }
  const already = findOpenPdfReader(opener.app, simpleId)
  if (already) {
    await revealExistingPdfLeaf(opener.app, already.leaf)
    await flashCitation(already.reader, citation)
    return { ok: true }
  }
  const target = await resolveCitationTarget(input.storage, opener.app, citation)
  if (!target.file && !target.url) {
    return { ok: false, title: target.title }
  }
  const subpath = pageSubpath(citation)
  try {
    if (target.file) {
      await opener.openFile(target.file, subpath)
    } else if (target.url) {
      await opener.openUrl(target.url, subpath)
    }
  } catch {
    return { ok: false, title: target.title }
  }
  const opened = await waitForPdfReader(opener.app, simpleId)
  if (!opened) {
    return { ok: false, title: target.title }
  }
  await revealExistingPdfLeaf(opener.app, opened.leaf)
  await flashCitation(opened.reader, citation)
  return { ok: true }
}
