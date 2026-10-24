/** Dexie stores schema version 4 as IndexedDB version 40. */
export const PDF_SCHEMA_VERSION = 4
export const PDF_NATIVE_VERSION = PDF_SCHEMA_VERSION * 10
export const PDF_DB_NAME = 'foxycape-pdf'
export const SIGN_KEY_STORE = 'signKeys'
export const SIGN_KEY_ID = 'device'

const PDF_DB_STORES: Record<string, string> = {
  kv: '[tableName+key], tableName',
  marks: '[ownerId+markId], [ownerId+simpleId+url], [ownerId+type]',
  readingprogress: '[ownerId+simpleId]',
  translates: '[ownerId+markId], [ownerId+simpleId+url], [ownerId+simpleId]',
  explains: '[ownerId+markId], [ownerId+simpleId]',
  lookups: '[ownerId+markId], [ownerId+simpleId]',
  llmChats: '[ownerId+id], [ownerId+updatedAt]',
  segments: '[ownerId+simpleId]',
  signKeys: 'id',
}

type ParsedIndex = {
  name: string
  keyPath: string | string[]
  unique: boolean
  multiEntry: boolean
  autoIncrement: boolean
}

const parseIndex = (token: string): ParsedIndex => {
  const unique = token.includes('&')
  const multiEntry = token.includes('*')
  const autoIncrement = token.includes('++')
  const name = token.replace(/[&*]|\+\+/g, '')
  const keyPath = name.startsWith('[') ? name.slice(1, -1).split('+') : name
  return { name, keyPath, unique, multiEntry, autoIncrement }
}

const createMissingStores = (db: IDBDatabase): void => {
  for (const [storeName, spec] of Object.entries(PDF_DB_STORES)) {
    if (db.objectStoreNames.contains(storeName)) {
      continue
    }
    const indexes = spec
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .map(parseIndex)
    const primary = indexes[0]
    if (!primary) {
      throw new Error(`Missing primary key for ${storeName}.`)
    }
    const store = db.createObjectStore(storeName, {
      keyPath: primary.keyPath,
      autoIncrement: primary.autoIncrement,
    })
    for (const index of indexes.slice(1)) {
      store.createIndex(index.name, index.keyPath, {
        unique: index.unique,
        multiEntry: index.multiEntry,
      })
    }
  }
}

const openNative = (name: string, version?: number): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable; cannot store the device signing key.'))
      return
    }
    const request = version == null ? indexedDB.open(name) : indexedDB.open(name, version)
    request.onupgradeneeded = (event) => {
      const oldVersion = (event as IDBVersionChangeEvent).oldVersion
      if (oldVersion < PDF_NATIVE_VERSION) {
        createMissingStores(request.result)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open the device sign database.'))
  })

const isVersionError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'name' in error &&
  (error as { name?: string }).name === 'VersionError'

/**
 * Open the business database without importing Dexie.
 * A newer Dexie schema still opens, and then requires the signKeys store.
 */
export const openPdfDatabase = async (name = PDF_DB_NAME): Promise<IDBDatabase> => {
  try {
    return await openNative(name, PDF_NATIVE_VERSION)
  } catch (error) {
    if (!isVersionError(error)) {
      throw error
    }
    const db = await openNative(name)
    if (!db.objectStoreNames.contains(SIGN_KEY_STORE)) {
      db.close()
      throw new Error(
        'signKeys is missing. Raise PDF_SCHEMA_VERSION together with the database schema.',
      )
    }
    return db
  }
}
