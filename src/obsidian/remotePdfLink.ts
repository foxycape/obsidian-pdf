import type { App, TFile } from 'obsidian'
import { sanitizeFileNamePart } from './pdfImageRef'

export type RemotePdfHref = {
  /** Document URL without hash (query string kept). */
  url: string
  subpath?: string
}

const isHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value)

/** Drop `#…` so the same remote PDF shares one tab / sidecar name. */
export const normalizeRemoteDocumentUrl = (href: string): string | undefined => {
  const parsed = parseRemotePdfHref(href)
  return parsed?.url
}

export const parseRemotePdfHref = (
  href: string | null | undefined,
): RemotePdfHref | null => {
  if (!href) {
    return null
  }
  const trimmed = href.trim()
  if (!isHttpUrl(trimmed)) {
    return null
  }
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return null
  }
  let path: string
  try {
    path = decodeURIComponent(parsed.pathname)
  } catch {
    path = parsed.pathname
  }
  if (!path.toLowerCase().endsWith('.pdf')) {
    return null
  }
  const url = `${parsed.origin}${parsed.pathname}${parsed.search}`
  const hash = parsed.hash
  return {
    url,
    subpath: hash ? hash : undefined,
  }
}

export const isRemotePdfUrl = (href: string | null | undefined): boolean =>
  parseRemotePdfHref(href) != null

/** Basename from the URL path, e.g. `paper.pdf`. */
export const fileNameFromRemotePdfUrl = (url: string): string => {
  try {
    const parsed = new URL(url)
    const last = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() ?? '')
    if (last.toLowerCase().endsWith('.pdf')) {
      return last
    }
  } catch {
    // ignore invalid URL
  }
  return 'remote.pdf'
}

export const displayNameFromRemotePdfUrl = (url: string): string => {
  const fileName = fileNameFromRemotePdfUrl(url)
  return fileName.replace(/\.pdf$/i, '') || 'Foxycape PDF'
}

/** Vault-safe sidecar note path next to the vault root: `{basename}.md`. */
export const resolveRemoteSidecarNotePath = (url: string): string => {
  const fileName = fileNameFromRemotePdfUrl(url)
  const basename = sanitizeFileNamePart(fileName.replace(/\.pdf$/i, ''))
  return `${basename || 'remote'}.md`
}

/**
 * Markdown link Obsidian can open (`[text](url)`, not `[[url]]`).
 * Wrap in `<>` when the URL contains characters that end a markdown destination.
 */
export const formatRemotePdfMarkdownLink = (
  documentUrl: string,
  subpath: string,
  alias = '↗',
): string => {
  const hash = !subpath
    ? ''
    : subpath.startsWith('#')
      ? subpath
      : `#${subpath}`
  const href = `${documentUrl}${hash}`
  const needsBrackets = /[\s()<>]/.test(href)
  return needsBrackets ? `[${alias}](<${href}>)` : `[${alias}](${href})`
}

export type PdfMarkdownLinkSource = {
  app: App
  pdfFile?: TFile
  sourceUrl?: string
}

export const buildPdfMarkdownLink = (
  source: PdfMarkdownLinkSource,
  subpath: string,
  alias = '↗',
  sourcePath = '',
): string => {
  if (source.sourceUrl) {
    return formatRemotePdfMarkdownLink(source.sourceUrl, subpath, alias)
  }
  if (source.pdfFile) {
    return source.app.fileManager.generateMarkdownLink(
      source.pdfFile,
      sourcePath,
      subpath,
      alias,
    )
  }
  return ''
}
