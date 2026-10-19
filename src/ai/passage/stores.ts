import { getRandomId } from '@foxycape/core/kernal/common/uuid'
import { ANONYMOUS_OWNER_ID } from '@/storage/ownerId'
import type { DexieStorage } from '@/storage/DexieStorage'
import { toStorageValue } from '@/storage/toStorageValue'
import type { ExplainDetail, ExplainMark, LookupMark, TranslateEngine, TranslateMark } from './types'
import type { FixedContentRange } from '@foxycape/core/kernal/ContentRange'

type TableName = 'translates' | 'explains' | 'lookups'

type PassageLocation = {
  navUrl?: string
  navTitle?: string
  contentRange?: FixedContentRange
}

const locationOf = (
  input: PassageLocation,
  existing: PassageLocation | undefined,
): PassageLocation => ({
  navUrl: input.navUrl ?? existing?.navUrl,
  navTitle: input.navTitle ?? existing?.navTitle,
  contentRange: input.contentRange ?? existing?.contentRange,
})

const tableOf = (storage: DexieStorage, name: TableName) => storage.getAiTable(name)

const listBySimpleId = async <T extends { simpleId: string; ownerId?: string }>(
  storage: DexieStorage,
  name: TableName,
  simpleId: string,
): Promise<T[]> => {
  const table = tableOf(storage, name)
  if (!table || !simpleId) {
    return []
  }
  const rows = await table.where('[ownerId+simpleId]').equals([ANONYMOUS_OWNER_ID, simpleId]).toArray()
  return rows as T[]
}

export const listTranslateMarks = (storage: DexieStorage, simpleId: string) =>
  listBySimpleId<TranslateMark>(storage, 'translates', simpleId)

export const listExplainMarks = (storage: DexieStorage, simpleId: string) =>
  listBySimpleId<ExplainMark>(storage, 'explains', simpleId)

export const listLookupMarks = (storage: DexieStorage, simpleId: string) =>
  listBySimpleId<LookupMark>(storage, 'lookups', simpleId)

export const upsertTranslate = async (
  storage: DexieStorage,
  input: {
    markId: string
    simpleId: string
    text: string
    pageNumber?: number
    navUrl?: string
    navTitle?: string
    contentRange?: FixedContentRange
    engine: TranslateEngine
    languageCode: string
    translatedText: string
  },
): Promise<TranslateMark> => {
  const table = tableOf(storage, 'translates')
  if (!table) {
    throw new Error('Translate storage is not ready')
  }
  const now = Date.now()
  const existing = (await table.get([ANONYMOUS_OWNER_ID, input.markId])) as TranslateMark | undefined
  const results = (existing?.results ?? []).filter(
    (item) => !(item.engine === input.engine && item.languageCode === input.languageCode),
  )
  results.unshift({
    engine: input.engine,
    languageCode: input.languageCode,
    translatedText: input.translatedText,
    updatedAt: now,
  })
  const mark: TranslateMark = {
    markId: input.markId,
    simpleId: input.simpleId,
    text: input.text,
    url: existing?.url ?? '',
    pageNumber: input.pageNumber ?? existing?.pageNumber,
    ...locationOf(input, existing),
    results,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    ownerId: ANONYMOUS_OWNER_ID,
  }
  await table.put(toStorageValue(mark) as unknown as Record<string, unknown>)
  return mark
}

const upsertDetailMark = async <T extends { markId: string; results: { id: string; detail: ExplainDetail; updatedAt: number }[] }>(
  storage: DexieStorage,
  name: 'explains' | 'lookups',
  input: {
    markId: string
    simpleId: string
    text: string
    pageNumber?: number
    navUrl?: string
    navTitle?: string
    contentRange?: FixedContentRange
    detail: ExplainDetail
    body: string
  },
  readBody: (record: T['results'][number]) => string,
  writeBody: (body: string, detail: ExplainDetail, now: number) => T['results'][number],
  build: (base: {
    markId: string
    simpleId: string
    text: string
    pageNumber?: number
    navUrl?: string
    navTitle?: string
    contentRange?: FixedContentRange
    results: T['results']
    createdAt: number
    updatedAt: number
    ownerId: string
  }) => T,
): Promise<T> => {
  const table = tableOf(storage, name)
  if (!table) {
    throw new Error('Passage storage is not ready')
  }
  const now = Date.now()
  const existing = (await table.get([ANONYMOUS_OWNER_ID, input.markId])) as T | undefined
  const results = (existing?.results ?? []).filter((item) => item.detail !== input.detail)
  results.unshift(writeBody(input.body, input.detail, now))
  void readBody
  const mark = build({
    markId: input.markId,
    simpleId: input.simpleId,
    text: input.text,
    pageNumber: input.pageNumber ?? (existing as { pageNumber?: number } | undefined)?.pageNumber,
    ...locationOf(input, existing as PassageLocation | undefined),
    results,
    createdAt: (existing as { createdAt?: number } | undefined)?.createdAt ?? now,
    updatedAt: now,
    ownerId: ANONYMOUS_OWNER_ID,
  })
  await table.put(toStorageValue({ ...mark }) as Record<string, unknown>)
  return mark
}

export const upsertExplain = (
  storage: DexieStorage,
  input: {
    markId: string
    simpleId: string
    text: string
    pageNumber?: number
    navUrl?: string
    navTitle?: string
    contentRange?: FixedContentRange
    detail: ExplainDetail
    explanation: string
  },
) =>
  upsertDetailMark<ExplainMark>(
    storage,
    'explains',
    { ...input, body: input.explanation },
    (record) => record.explanation,
    (body, detail, now) => ({
      id: getRandomId(),
      detail,
      explanation: body,
      updatedAt: now,
    }),
    (base) => base,
  )

export const upsertLookup = (
  storage: DexieStorage,
  input: {
    markId: string
    simpleId: string
    text: string
    pageNumber?: number
    navUrl?: string
    navTitle?: string
    contentRange?: FixedContentRange
    detail: ExplainDetail
    lookup: string
  },
) =>
  upsertDetailMark<LookupMark>(
    storage,
    'lookups',
    { ...input, body: input.lookup },
    (record) => record.lookup,
    (body, detail, now) => ({
      id: getRandomId(),
      detail,
      lookup: body,
      updatedAt: now,
    }),
    (base) => base,
  )

const isFixedContentRange = (value: unknown): value is FixedContentRange => {
  if (!value || typeof value !== 'object') {
    return false
  }
  const range = value as FixedContentRange
  return range.kind === 'fixed' && Array.isArray(range.geometries) && range.geometries.length > 0
}

/** Selection geometry saved with an explain, lookup, or translation of this passage. */
export const findPassageContentRange = async (
  storage: DexieStorage,
  markId: string,
): Promise<FixedContentRange | undefined> => {
  if (!markId) {
    return undefined
  }
  const names: TableName[] = ['explains', 'lookups', 'translates']
  for (const name of names) {
    const table = tableOf(storage, name)
    if (!table) {
      continue
    }
    const row = (await table.get([ANONYMOUS_OWNER_ID, markId])) as
      | { contentRange?: unknown }
      | undefined
    const range = row?.contentRange
    if (isFixedContentRange(range)) {
      return range
    }
  }
  return undefined
}

export const findTranslateText = async (
  storage: DexieStorage,
  markId: string,
  engine: TranslateEngine,
  languageCode: string,
): Promise<string | undefined> => {
  const table = tableOf(storage, 'translates')
  if (!table || !markId) {
    return undefined
  }
  const row = (await table.get([ANONYMOUS_OWNER_ID, markId])) as TranslateMark | undefined
  return row?.results.find((item) => item.engine === engine && item.languageCode === languageCode)?.translatedText
}

export const findExplainText = async (
  storage: DexieStorage,
  markId: string,
  detail: ExplainDetail,
): Promise<string | undefined> => {
  const table = tableOf(storage, 'explains')
  if (!table || !markId) {
    return undefined
  }
  const row = (await table.get([ANONYMOUS_OWNER_ID, markId])) as ExplainMark | undefined
  return row?.results.find((item) => item.detail === detail)?.explanation
}

export const findLookupText = async (
  storage: DexieStorage,
  markId: string,
  detail: ExplainDetail,
): Promise<string | undefined> => {
  const table = tableOf(storage, 'lookups')
  if (!table || !markId) {
    return undefined
  }
  const row = (await table.get([ANONYMOUS_OWNER_ID, markId])) as LookupMark | undefined
  return row?.results.find((item) => item.detail === detail)?.lookup
}

export const countTranslates = async (storage: DexieStorage, simpleId: string): Promise<number> => {
  const rows = await listTranslateMarks(storage, simpleId)
  return rows.length
}

export const patchPassageNav = async (
  storage: DexieStorage,
  name: TableName,
  markId: string,
  nav: { navUrl?: string; navTitle?: string },
): Promise<void> => {
  const table = tableOf(storage, name)
  if (!table || !markId || (!nav.navTitle && !nav.navUrl)) {
    return
  }
  const row = (await table.get([ANONYMOUS_OWNER_ID, markId])) as
    | (PassageLocation & Record<string, unknown>)
    | undefined
  if (!row || row.navTitle || row.navUrl) {
    return
  }
  await table.put(toStorageValue({ ...row, navUrl: nav.navUrl, navTitle: nav.navTitle }))
}

export const deletePassage = async (
  storage: DexieStorage,
  name: TableName,
  markId: string,
): Promise<void> => {
  const table = tableOf(storage, name)
  if (!table || !markId) {
    return
  }
  await table.delete([ANONYMOUS_OWNER_ID, markId])
}
