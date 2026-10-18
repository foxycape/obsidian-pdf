import 'fake-indexeddb/auto'
import type { Mark } from '@/mark/Mark'
import { DexieStorage } from '@/storage/DexieStorage'
import { afterEach, describe, expect, it } from 'vitest'

let dbSeq = 0
const opened: DexieStorage[] = []

const createStorage = () => {
  dbSeq += 1
  const storage = new DexieStorage({ dbName: `dexie-mark-test-${dbSeq}` })
  opened.push(storage)
  return storage
}

const mark = (simpleId: string, markId: string, text = 'hello'): Mark => ({
  markId,
  simpleId,
  type: 'drawline',
  text,
  styleName: 'mark_pen',
  contentRange: {
    kind: 'fixed',
    geometries: [
      {
        pageNumber: 1,
        width: 10,
        height: 10,
        shape: 'rect',
        coords: [0, 0, 1, 1],
        rotation: 0,
      },
    ],
  },
  createdAt: 1,
  updatedAt: 2,
})

afterEach(async () => {
  const instances = opened.splice(0)
  await Promise.all(instances.map(async (instance) => {
    await instance.dropDb()
    await instance.dispose()
  }))
})

describe('DexieMarkStorage', () => {
  it('lists only the requested book and stores a missing url as an empty string', async () => {
    const db = createStorage()
    await db.marks.put('', mark('book-a', 'm1'))
    await db.marks.put('', mark('book-b', 'm2'))

    const rows = await db.marks.listByResource('', 'book-a')
    expect(rows.map((item) => item.markId)).toEqual(['m1'])
    expect(rows[0]?.url).toBe('')
    expect(rows[0]).not.toHaveProperty('ownerId')
  })

  it('round-trips reading progress by simpleId', async () => {
    const db = createStorage()
    await db.readingProgress.save('book-a', {
      total: 4,
      current: 1,
      createdAt: 1,
      updatedAt: 2,
      location: { url: '1', total: 1, current: 0.25 },
    } as never)
    await expect(db.readingProgress.get('book-a')).resolves.toMatchObject({
      total: 4,
      current: 1,
    })
    await expect(db.readingProgress.get('book-b')).resolves.toBeUndefined()
  })
})
