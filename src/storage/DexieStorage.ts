import Dexie, { type Table } from 'dexie'
import type { DataStorageOptions, IStorage } from '@foxycape/core/kernal/storage/IStorage'

type KvRow = {
  tableName: string
  key: string
  data: unknown
}

class FoxycapeKvDatabase extends Dexie {
  kv!: Table<KvRow, [string, string]>

  constructor(dbName: string) {
    super(dbName)
    this.version(1).stores({
      kv: '[tableName+key], tableName',
    })
  }
}

/**
 * Obsidian-side {@link IStorage} backed by a single Dexie object store.
 * Logical tables are encoded as `tableName` on each row so core can keep using
 * dynamic table names without localforage.
 */
export class DexieStorage implements IStorage {
  private readonly defaultDbName: string
  private readonly db: FoxycapeKvDatabase
  private disposed = false

  constructor(options?: DataStorageOptions) {
    this.defaultDbName = options?.dbName ?? 'foxycape-pdf'
    this.db = new FoxycapeKvDatabase(this.defaultDbName)
  }

  get dbName(): string {
    return this.defaultDbName
  }

  async getString(tableName: string, key: string): Promise<string> {
    const value = await this.get<string>(tableName, key)
    return value ?? ''
  }

  async get<T>(tableName: string, key: string): Promise<T> {
    const normalizedTable = this.formatTableName(tableName)
    const normalizedKey = this.formatKey(key)
    if (!normalizedTable || !normalizedKey) {
      return this.emptyValue<T>()
    }

    const row = await this.db.kv.get([normalizedTable, normalizedKey])
    if (row?.data === undefined) {
      return this.emptyValue<T>()
    }
    return row.data as T
  }

  async find<T>(
    tableName: string,
    predicate: (value: T, key: string, index: number) => boolean,
  ): Promise<T> {
    const rows = await this.listRows(tableName)
    let index = 0
    for (const row of rows) {
      if (predicate(row.data as T, row.key, index)) {
        return row.data as T
      }
      index += 1
    }
    return this.emptyValue<T>()
  }

  private emptyValue<T>(): T {
    return null as unknown as T
  }

  async filter<T>(
    tableName: string,
    predicate: (value: T, key: string, index: number) => boolean,
  ): Promise<T[]> {
    const rows = await this.listRows(tableName)
    const items: T[] = []
    let index = 0
    for (const row of rows) {
      if (predicate(row.data as T, row.key, index)) {
        items.push(row.data as T)
      }
      index += 1
    }
    return items
  }

  async getAll<T>(tableName: string): Promise<Map<string, T>> {
    const rows = await this.listRows(tableName)
    const map = new Map<string, T>()
    for (const row of rows) {
      map.set(row.key, row.data as T)
    }
    return map
  }

  async set<T>(
    tableName: string,
    key: string,
    content: T,
    _from?: 'local' | 'server',
  ): Promise<void> {
    const normalizedTable = this.formatTableName(tableName)
    const normalizedKey = this.formatKey(key)
    if (!normalizedTable || !normalizedKey || normalizedKey === 'undefined') {
      return
    }

    await this.db.kv.put({
      tableName: normalizedTable,
      key: normalizedKey,
      data: content,
    })
  }

  async delete(
    tableName: string,
    key: string,
    _from?: 'local' | 'server',
  ): Promise<void> {
    const normalizedTable = this.formatTableName(tableName)
    const normalizedKey = this.formatKey(key)
    if (!normalizedTable || !normalizedKey) {
      return
    }
    await this.db.kv.delete([normalizedTable, normalizedKey])
  }

  async getKeyCount(tableName: string): Promise<number> {
    const normalizedTable = this.formatTableName(tableName)
    if (!normalizedTable) {
      return 0
    }
    return this.db.kv.where('tableName').equals(normalizedTable).count()
  }

  async dropDb(): Promise<void> {
    this.db.close()
    await Dexie.delete(this.defaultDbName)
  }

  async dropTable(tableName: string): Promise<void> {
    const normalizedTable = this.formatTableName(tableName)
    if (!normalizedTable) {
      return
    }
    await this.db.kv.where('tableName').equals(normalizedTable).delete()
  }

  async getTableNames(): Promise<string[]> {
    const names = await this.db.kv.orderBy('tableName').uniqueKeys()
    return names.map((name) => String(name))
  }

  async dispose(): Promise<void> {
    if (this.disposed) {
      return
    }
    this.disposed = true
    this.db.close()
  }

  private async listRows(tableName: string): Promise<KvRow[]> {
    const normalizedTable = this.formatTableName(tableName)
    if (!normalizedTable) {
      return []
    }
    return this.db.kv.where('tableName').equals(normalizedTable).toArray()
  }

  private formatTableName = (tableName: string): string | undefined => {
    if (tableName == null || tableName === '' || tableName === 'undefined') {
      return undefined
    }
    return String(tableName).toLowerCase()
  }

  private formatKey = (key: string): string | undefined => {
    if (typeof key === 'number') {
      return String(key)
    }
    if (key == null || key === 'undefined') {
      return undefined
    }
    return key
  }
}
