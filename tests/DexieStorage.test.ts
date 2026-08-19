import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { DexieStorage } from '@/storage/DexieStorage'
import type { DataStorageOptions } from '@foxycape/core/kernal/storage/IStorage'

let dbSeq = 0
const opened: DexieStorage[] = []

const createStorage = (options?: DataStorageOptions) => {
  dbSeq += 1
  const storage = new DexieStorage({
    ...options,
    dbName: options?.dbName ?? `dexie-storage-test-${dbSeq}`,
  })
  opened.push(storage)
  return storage
}

afterEach(async () => {
  const instances = opened.splice(0)
  await Promise.all(instances.map(async (instance) => {
    try {
      await instance.dropDb()
    } catch {
      // ignore cleanup failures from already-closed instances
    }
    try {
      await instance.dispose()
    } catch {
      // ignore
    }
  }))
})

describe('DexieStorage', () => {
  it('uses the default database name when none is provided', () => {
    const storage = new DexieStorage()
    opened.push(storage)
    expect(storage.dbName).toBe('foxycape-pdf')
  })

  it('round-trips values through set and get', async () => {
    const db = createStorage()
    await db.set('books', 'id-1', { title: 'Foxy' })
    await expect(db.get('books', 'id-1')).resolves.toEqual({ title: 'Foxy' })
  })

  it('returns null for missing keys and missing tables', async () => {
    const db = createStorage()
    await expect(db.get('missing-table', 'k')).resolves.toBeNull()
    await db.set('books', 'id-1', 1)
    await expect(db.get('books', 'missing')).resolves.toBeNull()
  })

  it('treats table names as case-insensitive', async () => {
    const db = createStorage()
    await db.set('Books', 'k', 'v')
    await expect(db.get('books', 'k')).resolves.toBe('v')
    await expect(db.get('BOOKS', 'k')).resolves.toBe('v')
  })

  it('accepts numeric keys by stringifying them', async () => {
    const db = createStorage()
    await db.set('pages', 7 as unknown as string, 'seven')
    await expect(db.get('pages', '7')).resolves.toBe('seven')
  })

  it('ignores invalid table names and keys', async () => {
    const db = createStorage()
    await db.set('', 'k', 'v')
    await db.set('books', '', 'v')
    await db.set('books', 'undefined', 'v')
    await db.set('undefined', 'k', 'v')
    await expect(db.get('', 'k')).resolves.toBeNull()
    await expect(db.get('books', '')).resolves.toBeNull()
    await expect(db.get('books', 'undefined')).resolves.toBeNull()
    await expect(db.get('undefined', 'k')).resolves.toBeNull()
    await expect(db.count('books')).resolves.toBe(0)
  })

  it('deletes a key without affecting others', async () => {
    const db = createStorage()
    await db.set('books', 'a', 1)
    await db.set('books', 'b', 2)
    await db.delete('books', 'a')
    await expect(db.get('books', 'a')).resolves.toBeNull()
    await expect(db.get('books', 'b')).resolves.toBe(2)
    await expect(db.count('books')).resolves.toBe(1)
    await expect(db.getKeyCount('books')).resolves.toBe(1)
  })

  it('finds the first matching value', async () => {
    const db = createStorage()
    await db.set('books', 'a', { n: 1 })
    await db.set('books', 'b', { n: 2 })
    await db.set('books', 'c', { n: 3 })
    const found = await db.find<{ n: number }>('books', (value) => value.n > 1)
    expect(found).toEqual({ n: 2 })
    await expect(db.find<{ n: number }>('books', (value) => value.n > 9)).resolves.toBeNull()
  })

  it('filters matching values and keeps non-matches out', async () => {
    const db = createStorage()
    await db.set('books', 'a', { n: 1 })
    await db.set('books', 'b', { n: 2 })
    await db.set('books', 'c', { n: 3 })
    const items = await db.filter<{ n: number }>('books', (value) => value.n % 2 === 1)
    expect(items).toEqual([{ n: 1 }, { n: 3 }])
  })

  it('returns all key/value pairs from getAll', async () => {
    const db = createStorage()
    await db.set('books', 'a', 1)
    await db.set('books', 'b', 2)
    const all = await db.getAll<number>('books')
    expect(all.get('a')).toBe(1)
    expect(all.get('b')).toBe(2)
    expect(all.size).toBe(2)
  })

  it('does not let getAll callers mutate the stored map', async () => {
    const db = createStorage()
    await db.set('books', 'a', 1)
    const all = await db.getAll<number>('books')
    all.delete('a')
    all.set('b', 2)
    const again = await db.getAll<number>('books')
    expect(again.get('a')).toBe(1)
    expect(again.has('b')).toBe(false)
  })

  it('counts keys in a table', async () => {
    const db = createStorage()
    await expect(db.count('books')).resolves.toBe(0)
    await db.set('books', 'a', 1)
    await db.set('books', 'b', 2)
    await expect(db.count('books')).resolves.toBe(2)
  })

  it('lists created table names', async () => {
    const db = createStorage()
    await db.set('books', 'a', 1)
    await db.set('marks', 'b', 2)
    const names = await db.getTableNames()
    expect(names.map((name) => name.toLowerCase()).sort()).toEqual(['books', 'marks'])
  })

  it('keeps hyphenated table names isolated when dropping one table', async () => {
    const db = createStorage()
    await db.set('imageSizes-book1', '0', 'a')
    await db.set('imageSizes-book1-ch', '0', 'b')
    await db.set('pdf-passwords', 'id', 'secret')
    await db.dropTable('imageSizes-book1')
    await expect(db.get('imageSizes-book1', '0')).resolves.toBeNull()
    await expect(db.get('imageSizes-book1-ch', '0')).resolves.toBe('b')
    await expect(db.get('pdf-passwords', 'id')).resolves.toBe('secret')
  })

  it('clears a table without dropping other tables', async () => {
    const db = createStorage()
    await db.set('books', 'a', 1)
    await db.set('marks', 'b', 2)
    await db.dropTable('books')
    await expect(db.get('books', 'a')).resolves.toBeNull()
    await expect(db.count('books')).resolves.toBe(0)
    await expect(db.get('marks', 'b')).resolves.toBe(2)
  })

  it('dropDb removes data for a new instance with the same name', async () => {
    const dbName = `dexie-storage-drop-${++dbSeq}`
    const db = createStorage({ dbName })
    await db.set('books', 'a', 1)
    await db.dropDb()
    const next = createStorage({ dbName })
    await expect(next.get('books', 'a')).resolves.toBeNull()
    await expect(next.count('books')).resolves.toBe(0)
  })

  it('dispose is idempotent', async () => {
    const db = createStorage()
    await db.set('books', 'a', 1)
    await db.dispose()
    await db.dispose()
  })
})
