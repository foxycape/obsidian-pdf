import type { Table } from 'dexie'
import type { Progress } from '@foxycape/core/kernal'
import type { IReadingProgressStore } from './IReadingProgressStore'
import { ANONYMOUS_OWNER_ID } from './ownerId'
import { toStorageValue } from './toStorageValue'

export type ReadingProgressRow = Progress & { ownerId: string; simpleId: string }

type ReadingProgressTableSource = () => Table<ReadingProgressRow, [string, string]> | undefined

const toProgress = (row: ReadingProgressRow): Progress => {
  const { ownerId: _ownerId, simpleId: _simpleId, ...progress } = row
  return progress as Progress
}

/**
 * Reading progress on the Dexie `readingprogress` object store, keyed by simpleId.
 */
export class ReadingProgressStore implements IReadingProgressStore {
  constructor(private readonly getTable: ReadingProgressTableSource) {}

  get = async (simpleId: string): Promise<Progress | undefined> => {
    const table = this.getTable()
    const id = this.formatSimpleId(simpleId)
    if (!table || !id) {
      return undefined
    }
    const row = await table.get([ANONYMOUS_OWNER_ID, id])
    return row ? toProgress(row) : undefined
  }

  save = async (simpleId: string, progress: Progress): Promise<void> => {
    const table = this.getTable()
    const id = this.formatSimpleId(simpleId)
    if (!table || !id || !progress) {
      return
    }
    await table.put(
      toStorageValue({
        ...progress,
        ownerId: ANONYMOUS_OWNER_ID,
        simpleId: id,
      }),
    )
  }

  delete = async (simpleId: string): Promise<void> => {
    const table = this.getTable()
    const id = this.formatSimpleId(simpleId)
    if (!table || !id) {
      return
    }
    await table.delete([ANONYMOUS_OWNER_ID, id])
  }

  private formatSimpleId = (simpleId: string | undefined): string | undefined => {
    if (simpleId == null || simpleId === '' || simpleId === 'undefined') {
      return undefined
    }
    return simpleId
  }
}
