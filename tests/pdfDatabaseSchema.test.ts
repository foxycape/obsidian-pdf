import 'fake-indexeddb/auto'
import Dexie, { type Table } from 'dexie'
import { describe, expect, it } from 'vitest'
import { DexieStorage } from '@/storage/DexieStorage'
import {
  openPdfDatabase,
  PDF_NATIVE_VERSION,
  SIGN_KEY_STORE,
} from '@/storage/pdfDatabaseSchema'

let dbSeq = 0

type KvRow = {
  tableName: string
  key: string
  data: unknown
}

class Version3Database extends Dexie {
  kv!: Table<KvRow, [string, string]>

  constructor(name: string) {
    super(name)
    this.version(1).stores({
      kv: '[tableName+key], tableName',
    })
    this.version(2).stores({
      kv: '[tableName+key], tableName',
      marks: '[ownerId+markId], [ownerId+simpleId+url], [ownerId+type]',
      readingprogress: '[ownerId+simpleId]',
    })
    this.version(3).stores({
      kv: '[tableName+key], tableName',
      marks: '[ownerId+markId], [ownerId+simpleId+url], [ownerId+type]',
      readingprogress: '[ownerId+simpleId]',
      translates: '[ownerId+markId], [ownerId+simpleId+url], [ownerId+simpleId]',
      explains: '[ownerId+markId], [ownerId+simpleId]',
      lookups: '[ownerId+markId], [ownerId+simpleId]',
      llmChats: '[ownerId+id], [ownerId+updatedAt]',
      segments: '[ownerId+simpleId]',
    })
  }
}

describe('pdf business database', () => {
  it('adds signKeys to an existing version 3 database and keeps kv readable', async () => {
    const name = `foxycape-pdf-v3-${++dbSeq}`
    const previous = new Version3Database(name)
    await previous.kv.put({ tableName: 'notes', key: 'one', data: 'kept' })
    previous.close()

    const upgraded = await openPdfDatabase(name)
    expect(upgraded.version).toBe(PDF_NATIVE_VERSION)
    expect(upgraded.objectStoreNames.contains(SIGN_KEY_STORE)).toBe(true)
    upgraded.close()

    const storage = new DexieStorage({ dbName: name })
    expect(await storage.get('notes', 'one')).toBe('kept')
    await storage.set('notes', 'two', 'next')
    expect(await storage.get('notes', 'two')).toBe('next')
    await storage.dropDb()
    await storage.dispose()
  })

  it('creates the business schema from scratch so Dexie can read it', async () => {
    const name = `foxycape-pdf-fresh-${++dbSeq}`
    const created = await openPdfDatabase(name)
    expect(created.version).toBe(PDF_NATIVE_VERSION)
    expect(created.objectStoreNames.contains('kv')).toBe(true)
    expect(created.objectStoreNames.contains(SIGN_KEY_STORE)).toBe(true)
    created.close()

    const storage = new DexieStorage({ dbName: name })
    await storage.set('notes', 'one', 'fresh')
    expect(await storage.get('notes', 'one')).toBe('fresh')
    await storage.dropDb()
    await storage.dispose()
  })
})
