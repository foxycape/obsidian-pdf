import 'fake-indexeddb/auto'
import { createHash } from 'node:crypto'
import { computeMd5 } from '@/crypto/MD5'
import { createHasher, type StreamingHasher } from '@/crypto/hash'
import type { DocumentHasher } from '@/workers/DocumentHasher'
import type { Mark } from '@/mark/Mark'
import { DexieStorage } from '@/storage/DexieStorage'
import type { ByteRangeReader } from '@/storage/legacy/ByteRangeReader'
import { classifyLegacyMarkTables } from '@/storage/legacy/classifyLegacyMarkTables'
import { LegacyMarkCatalog } from '@/storage/legacy/LegacyMarkCatalog'
import { SHA1_CHUNK_BYTES } from '@/storage/legacy/legacyHashes'
import { migrateOpenedDocument, type MigrateOpenedDocumentOptions } from '@/storage/legacy/migrateLegacyMarks'
import { afterEach, describe, expect, it } from 'vitest'

let dbSeq = 0
const opened: DexieStorage[] = []

const createStorage = () => {
  dbSeq += 1
  const storage = new DexieStorage({ dbName: `legacy-mark-test-${dbSeq}` })
  opened.push(storage)
  return storage
}

const fill = (size: number) => {
  const bytes = new Uint8Array(size)
  for (let index = 0; index < size; index += 1) {
    bytes[index] = index % 251
  }
  return bytes
}

const rangeReader = (bytes: Uint8Array, maxWindow?: number): ByteRangeReader & { reads: number } => {
  const reader = {
    reads: 0,
    size: bytes.byteLength,
    read: async (start: number, end: number) => {
      if (maxWindow != null && end - start > maxWindow) {
        throw new Error(`read window ${end - start} exceeds ${maxWindow}`)
      }
      reader.reads += 1
      return bytes.subarray(start, end)
    },
    close: async () => {},
  }
  return reader
}

const legacyMark = (markId: string, resourceId: string, text = 'quoted'): Mark & { resourceId: string } => ({
  markId,
  resourceId,
  simpleId: '',
  type: 'drawline',
  text,
  styleName: 'mark_pen',
  contentRange: {
    kind: 'fixed',
    geometries: [
      {
        pageNumber: 2,
        width: 10,
        height: 10,
        shape: 'rect',
        coords: [1, 2, 3, 4],
        rotation: 0,
      },
    ],
  },
  createdAt: 10,
  updatedAt: 11,
})

const createTestHasher = (): DocumentHasher => {
  let sha1: StreamingHasher | undefined
  return {
    computeMd5: (bytes) => computeMd5(bytes),
    beginSha1: async () => {
      sha1 = await createHasher('SHA-1')
    },
    updateSha1: async (chunk) => {
      if (!sha1) {
        throw new Error('SHA-1 hasher is not initialized')
      }
      sha1.update(chunk)
    },
    digestSha1: async () => {
      if (!sha1) {
        throw new Error('SHA-1 hasher is not initialized')
      }
      const hash = sha1.digest()
      sha1 = undefined
      return hash
    },
    exclusive: (task) => task(),
  }
}

const migrate = (options: Omit<MigrateOpenedDocumentOptions, 'hasher'>) =>
  migrateOpenedDocument({ ...options, hasher: createTestHasher() })

afterEach(async () => {
  const instances = opened.splice(0)
  await Promise.all(instances.map(async (instance) => {
    await instance.dropDb()
    await instance.dispose()
  }))
})

describe('classifyLegacyMarkTables', () => {
  it('splits 32-hex and 40-hex mark tables', () => {
    const md5 = 'a'.repeat(32)
    const sha1 = 'b'.repeat(40)
    const classified = classifyLegacyMarkTables([
      `mark-${md5.toUpperCase()}`,
      `mark-${sha1}`,
      'mark-colors',
      'readingprogress',
    ])
    expect(classified.md5).toEqual([`mark-${md5}`])
    expect(classified.sha1).toEqual([`mark-${sha1}`])
  })
})

describe('migrateOpenedDocument', () => {
  it('moves a 32-hex table using only the first 5MB and keeps markId', async () => {
    const db = createStorage()
    const bytes = fill(6 * 1024 * 1024)
    const headMd5 = createHash('md5').update(bytes.subarray(0, 5 * 1024 * 1024)).digest('hex')
    const tableName = `mark-${headMd5}`
    await db.set(tableName, 'legacy-mark', legacyMark('legacy-mark', headMd5, 'from-kv'))
    await db.set('readingprogress', headMd5, {
      total: 8,
      current: 3,
      createdAt: 1,
      updatedAt: 2,
      location: { url: '3', total: 1, current: 0.3 },
    })
    const catalog = new LegacyMarkCatalog()
    await catalog.load(db)
    const headBytes = 5 * 1024 * 1024
    const prefix = rangeReader(bytes, 1024 * 1024)
    const read = prefix.read
    prefix.read = async (start, end) => {
      if (start >= headBytes) {
        throw new Error(`read starts past the 5MB prefix: ${start}`)
      }
      return read(start, end)
    }

    const changed = await migrate({
      kv: db,
      marks: db.marks,
      readingProgress: db.readingProgress,
      catalog,
      simpleId: 'new-simple',
      prefix,
    })

    expect(changed).toBe(true)
    const marks = await db.marks.listByResource('', 'new-simple')
    expect(marks).toHaveLength(1)
    expect(marks[0]?.markId).toBe('legacy-mark')
    expect(marks[0]?.text).toBe('from-kv')
    expect(marks[0]?.simpleId).toBe('new-simple')
    await expect(db.get(tableName, 'legacy-mark')).resolves.toBeNull()
    await expect(db.readingProgress.get('new-simple')).resolves.toMatchObject({ current: 3, total: 8 })
    expect(prefix.reads).toBeGreaterThan(0)
  })

  it('does not replace a mark that already uses the same markId', async () => {
    const db = createStorage()
    const bytes = fill(32)
    const headMd5 = createHash('md5').update(bytes).digest('hex')
    const tableName = `mark-${headMd5}`
    const current = legacyMark('same', headMd5, 'current')
    const { resourceId: _resourceId, ...stored } = current
    await db.marks.put('', { ...stored, simpleId: 'new-simple' })
    await db.set(tableName, 'same', legacyMark('same', headMd5, 'old'))
    const catalog = new LegacyMarkCatalog()
    await catalog.load(db)

    await migrate({
      kv: db,
      marks: db.marks,
      readingProgress: db.readingProgress,
      catalog,
      simpleId: 'new-simple',
      prefix: rangeReader(bytes),
    })

    await expect(db.marks.get('', 'same')).resolves.toMatchObject({ text: 'current', simpleId: 'new-simple' })
  })

  it('hashes a local file in windows and skips a second open', async () => {
    const db = createStorage()
    const bytes = fill(SHA1_CHUNK_BYTES + 32)
    const sha1 = createHash('sha1').update(bytes).digest('hex')
    const tableName = `mark-${sha1}`
    await db.set(tableName, 'sha-mark', legacyMark('sha-mark', sha1))
    const catalog = new LegacyMarkCatalog()
    await catalog.load(db)
    const localFile = rangeReader(bytes, SHA1_CHUNK_BYTES)

    const changed = await migrate({
      kv: db,
      marks: db.marks,
      readingProgress: db.readingProgress,
      catalog,
      simpleId: 'after-sha',
      localFile,
    })

    expect(changed).toBe(true)
    expect(localFile.reads).toBeGreaterThan(1)
    await expect(db.marks.get('', 'sha-mark')).resolves.toMatchObject({
      markId: 'sha-mark',
      simpleId: 'after-sha',
    })
    await expect(db.get(tableName, 'sha-mark')).resolves.toBeNull()

    const readsAfter = localFile.reads
    await migrate({
      kv: db,
      marks: db.marks,
      readingProgress: db.readingProgress,
      catalog,
      simpleId: 'after-sha',
      localFile,
    })
    expect(localFile.reads).toBe(readsAfter)
  })

  it('does not scan SHA-1 when the open has no local file', async () => {
    const db = createStorage()
    const sha1 = 'c'.repeat(40)
    const tableName = `mark-${sha1}`
    await db.set(tableName, 'remote-mark', legacyMark('remote-mark', sha1))
    const catalog = new LegacyMarkCatalog()
    await catalog.load(db)
    const prefix = rangeReader(fill(16))

    const changed = await migrate({
      kv: db,
      marks: db.marks,
      readingProgress: db.readingProgress,
      catalog,
      simpleId: 'remote-simple',
      prefix,
    })

    expect(changed).toBe(false)
    await expect(db.get(tableName, 'remote-mark')).resolves.toMatchObject({ markId: 'remote-mark' })
    await expect(db.marks.listByResource('', 'remote-simple')).resolves.toEqual([])
    expect(prefix.reads).toBe(0)
  })

  it('does not hash when no legacy mark tables remain', async () => {
    const db = createStorage()
    const catalog = new LegacyMarkCatalog()
    await catalog.load(db)
    const prefix = rangeReader(fill(8))

    await migrate({
      kv: db,
      marks: db.marks,
      readingProgress: db.readingProgress,
      catalog,
      simpleId: 'fresh',
      prefix,
      localFile: prefix,
    })

    expect(prefix.reads).toBe(0)
  })
})
