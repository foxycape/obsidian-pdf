import type { App, TFile } from 'obsidian'
import {
  buildPdfDeepLinkFragment,
  escapeMarkdownText,
} from '@/obsidian/selectionLink'
import { buildPdfMarkdownLink } from '@/obsidian/remotePdfLink'
import { ensureSidecarNote } from '@/obsidian/markNoteSync'
import type { PassageNoteKind } from '../runtime'

export const buildAiNoteAppendBlock = (
  app: App,
  source: { pdfFile?: TFile; sourceUrl?: string },
  noteFile: TFile,
  input: {
    kind: PassageNoteKind
    markId: string
    text: string
    body: string
    pageNumber?: number
  },
): string => {
  const subpath = buildPdfDeepLinkFragment({
    pageNumber: input.pageNumber,
    markId: input.markId,
  })
  const link = buildPdfMarkdownLink(
    { app, pdfFile: source.pdfFile, sourceUrl: source.sourceUrl },
    subpath,
    '↗',
    noteFile.path,
  )
  const heading = input.kind === 'explain' ? 'Explain' : 'Lookup'
  const quote = escapeMarkdownText(input.text.trim())
  const body = input.body.trim()
  return `\n> ${quote} ${link}\n\n**${heading}**\n\n${body}\n`
}

export const appendAiNote = async (
  app: App,
  source: { pdfFile?: TFile; sourceUrl?: string },
  input: {
    kind: PassageNoteKind
    markId: string
    text: string
    body: string
    pageNumber?: number
  },
): Promise<TFile> => {
  const noteFile = await ensureSidecarNote(app, source)
  const block = buildAiNoteAppendBlock(app, source, noteFile, input)
  await app.vault.append(noteFile, block)
  return noteFile
}
