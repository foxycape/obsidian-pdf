import type { Reader } from '@foxycape/core/kernal'
import { getRandomId } from '@foxycape/core/kernal/common/uuid'
import { ANONYMOUS_OWNER_ID } from '@/storage/ownerId'
import type { DexieStorage } from '@/storage/DexieStorage'
import { toStorageValue } from '@/storage/toStorageValue'
import { getLlm } from '../llm'

export const AUTO_SEGMENT_SUMMARY_MAX_CHARS = 2_000_000
const SEGMENT_CHAR_BUDGET = 12_000

export type PdfSegment = {
  id: string
  sequence: number
  title: string
  summary: string
  startPage: number
  endPage: number
  text: string
  pages?: { pageNumber: number; text: string }[]
}

export type SegmentCache = {
  ownerId: string
  simpleId: string
  status: 'ready' | 'declined'
  charCount: number
  segments: PdfSegment[]
  updatedAt: number
}

const cacheKey = (simpleId: string): [string, string] => [ANONYMOUS_OWNER_ID, simpleId]

export const readSegmentCache = async (
  storage: DexieStorage,
  simpleId: string,
): Promise<SegmentCache | null> => {
  const table = storage.getAiTable('segments')
  if (!table || !simpleId) {
    return null
  }
  const row = (await table.get(cacheKey(simpleId))) as SegmentCache | undefined
  return row ?? null
}

const writeCache = async (storage: DexieStorage, cache: SegmentCache) => {
  const table = storage.getAiTable('segments')
  if (!table) {
    throw new Error('Segment storage is not ready')
  }
  await table.put(toStorageValue({ ...cache }))
}

const collectPages = async (reader: Reader): Promise<{ pageNumber: number; text: string }[]> => {
  const parser = reader.getFileParser()
  if (!parser) {
    return []
  }
  const docs = await parser.getTextDocuments()
  const pages: { pageNumber: number; text: string }[] = []
  for (let index = 0; index < docs.length; index += 1) {
    const text = (await docs[index].getPlaintext())?.replace(/\s+/g, ' ').trim() ?? ''
    if (!text) {
      continue
    }
    const fromUrl = Number.parseInt(docs[index].url ?? '', 10)
    pages.push({ pageNumber: Number.isFinite(fromUrl) && fromUrl > 0 ? fromUrl : index + 1, text })
  }
  return pages
}

const chunkPages = (pages: { pageNumber: number; text: string }[]): PdfSegment[] => {
  const segments: PdfSegment[] = []
  let bucket: { pageNumber: number; text: string }[] = []
  let chars = 0
  const flush = () => {
    if (bucket.length === 0) {
      return
    }
    const text = bucket.map((page) => page.text).join('\n')
    segments.push({
      id: String(segments.length + 1),
      sequence: segments.length,
      title: `Pages ${bucket[0].pageNumber}-${bucket[bucket.length - 1].pageNumber}`,
      summary: '',
      startPage: bucket[0].pageNumber,
      endPage: bucket[bucket.length - 1].pageNumber,
      text,
      pages: bucket.map((page) => ({ pageNumber: page.pageNumber, text: page.text })),
    })
    bucket = []
    chars = 0
  }
  for (const page of pages) {
    if (bucket.length > 0 && chars + page.text.length > SEGMENT_CHAR_BUDGET) {
      flush()
    }
    bucket.push(page)
    chars += page.text.length
  }
  flush()
  return segments
}

const summarizeSegment = async (segment: PdfSegment, signal?: AbortSignal): Promise<string> => {
  const llm = getLlm()
  const inuse = await llm.modelProvider.getInuseModel()
  const result = await llm.client.complete({
    taskId: getRandomId(),
    platformId: inuse.platformId,
    model: inuse.model,
    purpose: 'summary',
    signal,
    stream: false,
    messages: [
      {
        role: 'system',
        content: 'Summarize this book excerpt in 2-4 sentences. Do not invent events that are not in the text.',
      },
      { role: 'user', content: segment.text.slice(0, 14000) },
    ],
  })
  return result.content.trim()
}

export const clearDeclinedSegments = async (storage: DexieStorage, simpleId: string): Promise<void> => {
  const existing = await readSegmentCache(storage, simpleId)
  if (existing?.status !== 'declined') {
    return
  }
  const table = storage.getAiTable('segments')
  await table?.delete(cacheKey(simpleId))
}

export const ensurePdfSegmentSummaries = async (input: {
  reader: Reader
  storage: DexieStorage
  simpleId: string
  askLongTextConsent?: (charCount: number) => Promise<boolean>
  onPhase?: (phase: 'extract' | 'summarize') => void
  onProgress?: (done: number, total: number) => void
  signal?: AbortSignal
}): Promise<SegmentCache> => {
  const existing = await readSegmentCache(input.storage, input.simpleId)
  if (existing?.status === 'ready' && existing.segments.some((item) => item.summary.trim())) {
    return existing
  }
  if (existing?.status === 'declined') {
    return existing
  }
  input.onPhase?.('extract')
  const pages = await collectPages(input.reader)
  const charCount = pages.reduce((sum, page) => sum + page.text.length, 0)
  if (charCount > AUTO_SEGMENT_SUMMARY_MAX_CHARS) {
    const allowed = await input.askLongTextConsent?.(charCount)
    if (!allowed) {
      const declined: SegmentCache = {
        ownerId: ANONYMOUS_OWNER_ID,
        simpleId: input.simpleId,
        status: 'declined',
        charCount,
        segments: [],
        updatedAt: Date.now(),
      }
      await writeCache(input.storage, declined)
      return declined
    }
  }
  const segments = chunkPages(pages)
  input.onPhase?.('summarize')
  input.onProgress?.(0, segments.length)
  let done = 0
  for (const segment of segments) {
    if (input.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }
    segment.summary = await summarizeSegment(segment, input.signal)
    done += 1
    input.onProgress?.(done, segments.length)
  }
  const ready: SegmentCache = {
    ownerId: ANONYMOUS_OWNER_ID,
    simpleId: input.simpleId,
    status: 'ready',
    charCount,
    segments,
    updatedAt: Date.now(),
  }
  await writeCache(input.storage, ready)
  return ready
}
