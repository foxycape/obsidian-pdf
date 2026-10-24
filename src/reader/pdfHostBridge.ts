import type { DexieStorage } from '@/storage/DexieStorage'
import type { IStorage } from '@/storage/IStorage'
import type { IGlobalWorker } from '@/workers/IGlobalWorker'

export type PdfRuntimeHost = {
  getStorage: () => DexieStorage
  getWorker: () => IGlobalWorker
  dispose: () => Promise<void>
}

const HOST_KEY = '__foxycapePdfHost'

type HostGlobal = Window & {
  [HOST_KEY]?: PdfRuntimeHost
}

const hostWindow = (): HostGlobal => window

export const installPdfHost = (host: PdfRuntimeHost): void => {
  hostWindow()[HOST_KEY] = host
}

export const tryReadPdfHost = (): PdfRuntimeHost | null => hostWindow()[HOST_KEY] ?? null

export const readPdfHost = (): PdfRuntimeHost => {
  const host = tryReadPdfHost()
  if (!host) {
    throw new Error('Foxycape PDF host is not ready.')
  }
  return host
}

/** Drop the database and worker when the reader bundle has installed them. */
export const disposeInstalledPdfHost = async (): Promise<void> => {
  const host = tryReadPdfHost()
  if (!host) {
    return
  }
  await host.dispose()
}

const storageOf = (): IStorage => readPdfHost().getStorage()

/**
 * Storage handle for the plugin shell. It does not open IndexedDB until a
 * method runs, which is after reader-bundle.js has installed the host.
 */
export const createLazyPdfStorage = (): IStorage => ({
  get dbName() {
    return storageOf().dbName
  },
  get: (tableName, key) => storageOf().get(tableName, key),
  find: (tableName, predicate) => storageOf().find(tableName, predicate),
  filter: (tableName, predicate) => storageOf().filter(tableName, predicate),
  getAll: (tableName) => storageOf().getAll(tableName),
  set: (tableName, key, content, from) => storageOf().set(tableName, key, content, from),
  count: (tableName) => storageOf().count(tableName),
  delete: (tableName, key, from) => storageOf().delete(tableName, key, from),
  dropDb: () => storageOf().dropDb(),
  dropTable: (tableName) => storageOf().dropTable(tableName),
  getTableNames: () => storageOf().getTableNames(),
  dispose: () => storageOf().dispose(),
})
