import { DexieStorage } from '@/storage'
import { createGlobalWorker, type IGlobalWorker } from '@/workers'
import { installPdfHost } from './pdfHostBridge'

let storage: DexieStorage | null = null
let worker: IGlobalWorker | null = null

/** IndexedDB handle. Constructed in the reader bundle, not in main.js. */
export const getPdfStorage = (): DexieStorage => {
  storage ??= new DexieStorage({ dbName: 'foxycape-pdf' })
  return storage
}

/** Hash and image worker. One copy lives in the reader bundle. */
export const getPdfWorker = (): IGlobalWorker => {
  worker ??= createGlobalWorker()
  return worker
}

export const disposePdfRuntime = async (): Promise<void> => {
  const currentWorker = worker
  const currentStorage = storage
  worker = null
  storage = null
  await currentWorker?.dispose()
  await currentStorage?.dispose()
}

installPdfHost({
  getStorage: getPdfStorage,
  getWorker: getPdfWorker,
  dispose: disposePdfRuntime,
})
