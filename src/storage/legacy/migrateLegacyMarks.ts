import type { Progress } from '@foxycape/core/kernal'
import type { Mark } from '@/mark/Mark'
import { hydrateLegacyMark } from '@/marker/hydrateLegacyMark'
import type { IMarkStorage } from '@/storage/IMarkStorage'
import type { IReadingProgressStore } from '@/storage/IReadingProgressStore'
import type { IStorage } from '@/storage/IStorage'
import type { DocumentHasher } from '@/workers/DocumentHasher'
import type { ByteRangeReader } from './ByteRangeReader'
import type { LegacyMarkCatalog } from './LegacyMarkCatalog'
import { computeChunkedSha1, computeHeadMd5 } from './legacyHashes'
import { ANONYMOUS_OWNER_ID } from '@/storage/ownerId'

const MIGRATION_TABLE = 'legacy-mark-migration'
const READING_PROGRESS_TABLE = 'readingprogress'

type MigrationState = {
  md5: boolean
  sha1: boolean
}

type LegacyMark = Mark & { resourceId?: string; simpleId?: string }

export type MigrateOpenedDocumentOptions = {
  kv: IStorage
  marks: IMarkStorage
  readingProgress: IReadingProgressStore
  catalog: LegacyMarkCatalog
  simpleId: string
  /** Bounded reader for the first 5MB. Omit when the source cannot be range-read. */
  prefix?: ByteRangeReader
  /** Local file reader for chunked SHA-1. Remote opens omit this. */
  localFile?: ByteRangeReader
  /** Hash worker shared with document id calculation. */
  hasher: DocumentHasher
}

const readState = async (kv: IStorage, simpleId: string): Promise<MigrationState> => {
  const value = await kv.get<MigrationState | null>(MIGRATION_TABLE, simpleId)
  if (!value) {
    return { md5: false, sha1: false }
  }
  return { md5: !!value.md5, sha1: !!value.sha1 }
}

const writeState = async (kv: IStorage, simpleId: string, state: MigrationState) => {
  await kv.set(MIGRATION_TABLE, simpleId, state)
}

const migrateMarkTable = async (
  kv: IStorage,
  marks: IMarkStorage,
  tableName: string,
  simpleId: string,
): Promise<boolean> => {
  const rows = await kv.getAll<LegacyMark>(tableName)
  let changed = false
  for (const [key, value] of rows) {
    if (!value) {
      continue
    }
    const hydrated = hydrateLegacyMark(value)
    if (!hydrated.markId) {
      hydrated.markId = key
    }
    const existing = await marks.get(ANONYMOUS_OWNER_ID, hydrated.markId)
    if (existing) {
      continue
    }
    hydrated.simpleId = simpleId
    await marks.put(ANONYMOUS_OWNER_ID, hydrated)
    changed = true
  }
  await kv.dropTable(tableName)
  return changed
}

const migrateProgress = async (
  kv: IStorage,
  readingProgress: IReadingProgressStore,
  legacySimpleId: string,
  simpleId: string,
): Promise<boolean> => {
  const current = await readingProgress.get(simpleId)
  if (current) {
    return false
  }
  const legacy = await kv.get<Progress | null>(READING_PROGRESS_TABLE, legacySimpleId)
  if (!legacy) {
    return false
  }
  await readingProgress.save(simpleId, legacy)
  await kv.delete(READING_PROGRESS_TABLE, legacySimpleId)
  return true
}

/**
 * Move leftover KV marks onto the new simpleId.
 * SHA-1 runs only when `localFile` is provided. A missing reader leaves that flag unset.
 */
export const migrateOpenedDocument = async (
  options: MigrateOpenedDocumentOptions,
): Promise<boolean> => {
  const state = await readState(options.kv, options.simpleId)
  let changed = false

  if (!state.md5) {
    if (options.catalog.md5.size === 0) {
      state.md5 = true
    } else if (options.prefix) {
      const headMd5 = await computeHeadMd5(options.prefix, options.hasher)
      const tableName = `mark-${headMd5}`
      if (options.catalog.md5.has(tableName)) {
        changed = (await migrateMarkTable(options.kv, options.marks, tableName, options.simpleId)) || changed
        options.catalog.md5.delete(tableName)
      }
      changed =
        (await migrateProgress(options.kv, options.readingProgress, headMd5, options.simpleId)) ||
        changed
      state.md5 = true
    }
  }

  if (!state.sha1) {
    if (options.catalog.sha1.size === 0) {
      state.sha1 = true
    } else if (options.localFile) {
      const sha1 = await computeChunkedSha1(options.localFile, options.hasher)
      const tableName = `mark-${sha1}`
      if (options.catalog.sha1.has(tableName)) {
        changed = (await migrateMarkTable(options.kv, options.marks, tableName, options.simpleId)) || changed
        options.catalog.sha1.delete(tableName)
      }
      state.sha1 = true
    }
  }

  if (state.md5 || state.sha1) {
    const previous = await readState(options.kv, options.simpleId)
    await writeState(options.kv, options.simpleId, {
      md5: state.md5 || previous.md5,
      sha1: state.sha1 || previous.sha1,
    })
  }
  return changed
}
