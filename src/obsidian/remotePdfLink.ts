import type { App, TFile } from 'obsidian'
import { sanitizeFileNamePart } from './pdfImageRef'

export type RemotePdfHref = {
  /** Document URL without hash (query string kept). */
  url: string
  subpath?: string
}

const GOOGLE_DRIVE_HOST = 'drive.google.com'
const GOOGLE_DRIVE_FILE_ID_RE = /\/file\/d\/([^/]+)/i

const isHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value)

const tryParseHttpUrl = (href: string | null | undefined): URL | null => {
  if (!href) {
    return null
  }
  const trimmed = href.trim()
  if (!isHttpUrl(trimmed)) {
    return null
  }
  try {
    return new URL(trimmed)
  } catch {
    return null
  }
}

const toDocumentHref = (parsed: URL): RemotePdfHref => ({
  url: `${parsed.origin}${parsed.pathname}${parsed.search}`,
  subpath: parsed.hash ? parsed.hash : undefined,
})

const isGoogleDriveHost = (hostname: string): boolean =>
  hostname.toLowerCase() === GOOGLE_DRIVE_HOST

const extractGoogleDriveFileId = (parsed: URL): string | null => {
  const fromPath = parsed.pathname.match(GOOGLE_DRIVE_FILE_ID_RE)?.[1]
  if (fromPath) {
    return fromPath
  }
  const fromQuery = parsed.searchParams.get('id')?.trim()
  return fromQuery || null
}

export const toGoogleDriveDownloadUrl = (fileId: string): string =>
  `https://${GOOGLE_DRIVE_HOST}/uc?export=download&id=${encodeURIComponent(fileId)}`

/** `https://drive.google.com/file/d/{id}/view?usp=sharing` → direct download URL. */
export const parseGoogleDriveShareHref = (
  href: string | null | undefined,
): RemotePdfHref | null => {
  const parsed = tryParseHttpUrl(href)
  if (!parsed || !isGoogleDriveHost(parsed.hostname)) {
    return null
  }
  if (parsed.searchParams.get('usp') !== 'sharing') {
    return null
  }
  const fileId = extractGoogleDriveFileId(parsed)
  if (!fileId) {
    return null
  }
  return {
    url: toGoogleDriveDownloadUrl(fileId),
    subpath: parsed.hash ? parsed.hash : undefined,
  }
}

const parseGoogleDriveDownloadHref = (
  href: string | null | undefined,
): RemotePdfHref | null => {
  const parsed = tryParseHttpUrl(href)
  if (!parsed || !isGoogleDriveHost(parsed.hostname)) {
    return null
  }
  if (parsed.pathname !== '/uc' || parsed.searchParams.get('export') !== 'download') {
    return null
  }
  if (!parsed.searchParams.get('id')?.trim()) {
    return null
  }
  return toDocumentHref(parsed)
}

/** Drop `#…` so the same remote PDF shares one tab / sidecar name. */
export const normalizeRemoteDocumentUrl = (href: string): string | undefined => {
  const parsed =
    parseRemotePdfHref(href) ??
    parseGoogleDriveShareHref(href) ??
    parseGoogleDriveDownloadHref(href)
  return parsed?.url
}

export const parseRemotePdfHref = (
  href: string | null | undefined,
): RemotePdfHref | null => {
  const parsed = tryParseHttpUrl(href)
  if (!parsed) {
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
  return toDocumentHref(parsed)
}

/** Right-click targets: remote `.pdf` URLs and Google Drive share links. */
export const parseRemoteContextMenuHref = (
  href: string | null | undefined,
): RemotePdfHref | null => parseRemotePdfHref(href) ?? parseGoogleDriveShareHref(href)

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
    if (isGoogleDriveHost(parsed.hostname)) {
      const fileId = extractGoogleDriveFileId(parsed)
      if (fileId) {
        return `${fileId}.pdf`
      }
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
