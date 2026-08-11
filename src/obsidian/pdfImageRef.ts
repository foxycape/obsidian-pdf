import type { App, TFile } from 'obsidian'
import { buildPdfDeepLinkFragment } from './selectionLink'

export const PDF_IMAGE_REF_SENTINEL_PREFIX = 'foxycape-pdf-image-ref:'
export const PDF_IMAGE_REF_PENDING_TTL_MS = 5 * 60 * 1000

export type PdfImageRefKind = 'embed' | 'screenshot'

export type PdfImageLinkSource = {
  app: App
  pdfFile: TFile
}

export type StagePdfImageRefCopyOptions = {
  pngBlob: Blob
  pdfFile: TFile
  pageNumber: number
  kind: PdfImageRefKind
  /** Embed images: PDF object ref (e.g. `123R`). */
  nameHint?: string
  /** `x1,y1,x2,y2` user-space rect for `foxycape-rect` deep-link highlight. */
  rect?: string
  /** Injected clock for tests. */
  now?: () => number
}

export type PendingPdfImageRef = {
  id: string
  pngBlob: Blob
  pdfFile: TFile
  pageNumber: number
  kind: PdfImageRefKind
  nameHint?: string
  rect?: string
  stagedAt: number
}

let pendingRef: PendingPdfImageRef | null = null

const defaultNow = () => Date.now()

const createPendingId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `ref-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export const clearPendingPdfImageRef = (): void => {
  pendingRef = null
}

export const peekPendingPdfImageRef = (
  now: () => number = defaultNow,
): PendingPdfImageRef | null => {
  if (!pendingRef) {
    return null
  }
  if (now() - pendingRef.stagedAt > PDF_IMAGE_REF_PENDING_TTL_MS) {
    pendingRef = null
    return null
  }
  return pendingRef
}

export const consumePendingPdfImageRef = (
  now: () => number = defaultNow,
): PendingPdfImageRef | null => {
  const current = peekPendingPdfImageRef(now)
  pendingRef = null
  return current
}

/** Test helper: replace or clear the in-memory pending payload. */
export const __setPendingPdfImageRefForTests = (
  value: PendingPdfImageRef | null,
): void => {
  pendingRef = value
}

export const resolvePdfSiblingAssetFolder = (pdfFile: TFile): string => {
  const parent = pdfFile.parent
  if (!parent || parent.path === '/' || parent.path === '') {
    return pdfFile.basename
  }
  return `${parent.path}/${pdfFile.basename}`
}

export const sanitizeFileNamePart = (raw: string): string => {
  const cleaned = raw
    .trim()
    .replace(/[^\w.-]+/g, '_')
    .replace(/\.{2,}/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._]+|[._]+$/g, '')
  return cleaned || 'image'
}

export const formatScreenshotTimestamp = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}` +
    `${pad(date.getMonth() + 1)}` +
    `${pad(date.getDate())}` +
    `${pad(date.getHours())}` +
    `${pad(date.getMinutes())}` +
    `${pad(date.getSeconds())}`
  )
}

export const buildPdfImageAssetFileName = (options: {
  kind: PdfImageRefKind
  pageNumber: number
  nameHint?: string
  now?: () => number
}): string => {
  const page = Math.max(1, Math.floor(options.pageNumber))
  if (options.kind === 'screenshot') {
    const stamp = formatScreenshotTimestamp(new Date((options.now ?? defaultNow)()))
    return `shot-p${page}-${stamp}.png`
  }
  const hint = sanitizeFileNamePart(options.nameHint ?? 'image')
  return `p${page}-${hint}.png`
}

export const pathRelativeToNote = (notePath: string, targetPath: string): string => {
  const noteDir = notePath.includes('/')
    ? notePath.slice(0, notePath.lastIndexOf('/'))
    : ''
  const fromParts = noteDir ? noteDir.split('/') : []
  const toParts = targetPath.split('/')
  let i = 0
  while (i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) {
    i++
  }
  const ups = fromParts.slice(i).map(() => '..')
  const down = toParts.slice(i)
  const rel = [...ups, ...down].join('/')
  return rel || targetPath
}

/** Encode each path segment for markdown link targets; keep `/` separators. */
export const encodeMarkdownPath = (path: string): string => {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

/**
 * Clickable image that opens the PDF page (optional rect highlight):
 * `[![](Book/p3.png#page=3&foxycape-rect=…)](Book.pdf#page=3&foxycape-rect=…&name=p3.png)`
 *
 * The image path also carries the location fragment so Obsidian's Live Preview
 * keeps a parent node (`src`) that still points at the PDF deep link. `name=`
 * binds that PDF link to this image for right-click matching.
 */
export const formatClickablePdfImageMarkdown = (
  imagePathFromNote: string,
  pdfPathFromNote: string,
  pageNumber: number,
  rect?: string,
): string => {
  const img = encodeMarkdownPath(imagePathFromNote)
  const pdf = encodeMarkdownPath(pdfPathFromNote)
  const imageName =
    imagePathFromNote.split('/').pop() || imagePathFromNote
  const imageFragment = buildPdfDeepLinkFragment({ pageNumber, rect })
  const pdfFragment = buildPdfDeepLinkFragment({
    pageNumber,
    rect,
    name: imageName,
  })
  return `[![](${img}${imageFragment})](${pdf}${pdfFragment})`
}

export const ensurePdfSiblingAssetFolder = async (
  app: App,
  pdfFile: TFile,
): Promise<string> => {
  const folderPath = resolvePdfSiblingAssetFolder(pdfFile)
  const existing = app.vault.getAbstractFileByPath(folderPath)
  if (existing) {
    return folderPath
  }
  await app.vault.createFolder(folderPath)
  return folderPath
}

const resolveUniqueAssetPath = (app: App, folderPath: string, fileName: string): string => {
  const dot = fileName.lastIndexOf('.')
  const stem = dot >= 0 ? fileName.slice(0, dot) : fileName
  const ext = dot >= 0 ? fileName.slice(dot) : ''
  let candidate = `${folderPath}/${fileName}`
  let index = 2
  while (app.vault.getAbstractFileByPath(candidate)) {
    candidate = `${folderPath}/${stem}-${index}${ext}`
    index += 1
  }
  return candidate
}

export const savePdfImageAsset = async (
  app: App,
  pdfFile: TFile,
  pngBlob: Blob,
  fileName: string,
): Promise<TFile> => {
  const folderPath = await ensurePdfSiblingAssetFolder(app, pdfFile)
  const path = resolveUniqueAssetPath(app, folderPath, fileName)
  const data = await pngBlob.arrayBuffer()
  return app.vault.createBinary(path, data)
}

export const buildPasteMarkdownForImageRef = (
  notePath: string,
  imageFile: TFile,
  pdfFile: TFile,
  pageNumber: number,
  rect?: string,
): string => {
  const imageRel = pathRelativeToNote(notePath, imageFile.path)
  const pdfRel = pathRelativeToNote(notePath, pdfFile.path)
  return formatClickablePdfImageMarkdown(imageRel, pdfRel, pageNumber, rect)
}

/**
 * Stage PNG + metadata for paste-time vault write.
 * Also writes clipboard as PNG + text sentinel so external paste still gets the image.
 */
export const stagePdfImageRefCopy = async (
  options: StagePdfImageRefCopyOptions,
): Promise<PendingPdfImageRef> => {
  const now = options.now ?? defaultNow
  const id = createPendingId()
  const staged: PendingPdfImageRef = {
    id,
    pngBlob: options.pngBlob,
    pdfFile: options.pdfFile,
    pageNumber: options.pageNumber,
    kind: options.kind,
    nameHint: options.nameHint,
    rect: options.rect,
    stagedAt: now(),
  }
  pendingRef = staged

  const sentinel = `${PDF_IMAGE_REF_SENTINEL_PREFIX}${id}`
  const item = new ClipboardItem({
    'image/png': Promise.resolve(options.pngBlob),
    'text/plain': Promise.resolve(new Blob([sentinel], { type: 'text/plain' })),
  })
  await navigator.clipboard.write([item])
  return staged
}

export const matchesPendingImageRefSentinel = (
  text: string | null | undefined,
  pending: PendingPdfImageRef | null = peekPendingPdfImageRef(),
): boolean => {
  if (!text || !pending) {
    return false
  }
  return text.trim() === `${PDF_IMAGE_REF_SENTINEL_PREFIX}${pending.id}`
}
