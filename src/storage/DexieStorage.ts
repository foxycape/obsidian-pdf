import Dexie, { type Table } from 'dexie'
import { DataStorageOptions, type IStorage } from './IStorage'

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
 * Logical tables are encoded as `tableName` on each row so the host can keep using
 * dynamic table names without localforage.
 */
export class DexieStorage implements IStorage {
  private readonly defaultDbName: string
  private db: FoxycapeKvDatabase
  private disposed = false

  constructor(options?: DataStorageOptions) {
    this.defaultDbName = options?.dbName ?? 'foxycape-pdf'
    this.db = new FoxycapeKvDatabase(this.defaultDbName)
  }

  get dbName(): string {
    return this.defaultDbName
  }

  async get<T>(tableName: string, key: string): Promise<T> {
    if (this.disposed) {
      return this.emptyValue<T>()
    }
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
    if (this.disposed) {
      return this.emptyValue<T>()
    }
    const normalizedTable = this.formatTableName(tableName)
    if (!normalizedTable) {
      return this.emptyValue<T>()
    }

    let index = 0
    let found: T | undefined
    await this.db.kv
      .where('tableName')
      .equals(normalizedTable)
      .until(() => found !== undefined)
      .each((row) => {
        if (predicate(row.data as T, row.key, index)) {
          found = row.data as T
        }
        index += 1
      })
    return found !== undefined ? found : this.emptyValue<T>()
  }

  private emptyValue<T>(): T {
    return null
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
    if (this.disposed) {
      return
    }
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
    if (this.disposed) {
      return
    }
    const normalizedTable = this.formatTableName(tableName)
    const normalizedKey = this.formatKey(key)
    if (!normalizedTable || !normalizedKey) {
      return
    }
    await this.db.kv.delete([normalizedTable, normalizedKey])
  }

  async count(tableName: string): Promise<number> {
    return this.getKeyCount(tableName)
  }

  async getKeyCount(tableName: string): Promise<number> {
    if (this.disposed) {
      return 0
    }
    const normalizedTable = this.formatTableName(tableName)
    if (!normalizedTable) {
      return 0
    }
    return this.db.kv.where('tableName').equals(normalizedTable).count()
  }

  async dropDb(): Promise<void> {
    if (this.disposed) {
      return
    }
    this.db.close()
    await Dexie.delete(this.defaultDbName)
    if (this.disposed) {
      return
    }
    this.db = new FoxycapeKvDatabase(this.defaultDbName)
  }

  async dropTable(tableName: string): Promise<void> {
    if (this.disposed) {
      return
    }
    const normalizedTable = this.formatTableName(tableName)
    if (!normalizedTable) {
      return
    }
    await this.db.kv.where('tableName').equals(normalizedTable).delete()
  }

  async getTableNames(): Promise<string[]> {
    if (this.disposed) {
      return []
    }
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
    if (this.disposed) {
      return []
    }
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
