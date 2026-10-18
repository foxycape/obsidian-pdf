import Dexie, { type Table } from 'dexie'
import type { Mark } from '@/mark/Mark'
import type { IMarkStorage } from './IMarkStorage'
import { formatOwnerId } from './ownerId'

export type MarkRow = Mark & { ownerId: string; url: string }

type MarksTableSource = () => Table<MarkRow, [string, string]> | undefined

const toMark = (row: MarkRow): Mark => {
  const { ownerId: _ownerId, ...mark } = row
  return mark
}

/**
 * IndexedDB {@link IMarkStorage} on the Dexie `marks` object store.
 * `url` is stored as `''` when omitted so the compound index includes every row.
 */
export class DexieMarkStorage implements IMarkStorage {
  constructor(private readonly getTable: MarksTableSource) {}

  get = async (ownerId: string, markId: string): Promise<Mark | undefined> => {
    const table = this.getTable()
    const id = this.formatMarkId(markId)
    if (!table || !id) {
      return undefined
    }
    const row = await table.get([formatOwnerId(ownerId), id])
    return row ? toMark(row) : undefined
  }

  put = async (ownerId: string, mark: Mark): Promise<void> => {
    const table = this.getTable()
    const id = this.formatMarkId(mark?.markId)
    const simpleId = this.formatSimpleId(mark?.simpleId)
    if (!table || !id || !simpleId) {
      return
    }
    await table.put({
      ...mark,
      ownerId: formatOwnerId(ownerId),
      markId: id,
      simpleId,
      url: this.formatUrl(mark.url),
    })
  }

  delete = async (ownerId: string, markId: string): Promise<void> => {
    const table = this.getTable()
    const id = this.formatMarkId(markId)
    if (!table || !id) {
      return
    }
    await table.delete([formatOwnerId(ownerId), id])
  }

  listByResource = async (ownerId: string, simpleId: string): Promise<Mark[]> => {
    const table = this.getTable()
    const id = this.formatSimpleId(simpleId)
    if (!table || !id) {
      return []
    }
    const owner = formatOwnerId(ownerId)
    const rows = await table
      .where('[ownerId+simpleId+url]')
      .between([owner, id, Dexie.minKey], [owner, id, Dexie.maxKey])
      .toArray()
    return rows.map(toMark)
  }

  private formatMarkId = (markId: string | undefined): string | undefined => {
    if (markId == null || markId === '' || markId === 'undefined') {
      return undefined
    }
    return markId
  }

  private formatSimpleId = (simpleId: string | undefined): string | undefined => {
    if (simpleId == null || simpleId === '' || simpleId === 'undefined') {
      return undefined
    }
    return simpleId
  }

  private formatUrl = (url: string | undefined): string => url ?? ''
}
