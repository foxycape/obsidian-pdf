import { DexieStorage } from '@/storage'
import { LegacyMarkCatalog } from '@/storage/legacy/LegacyMarkCatalog'
import { createGlobalWorker, type IGlobalWorker } from '@/workers'

let storage: DexieStorage | null = null
let worker: IGlobalWorker | null = null
let catalog: LegacyMarkCatalog | null = null
let ready: Promise<void> | null = null

/** IndexedDB handle shared by the reader and AI. Constructed on first use. */
export const getPdfStorage = (): DexieStorage => {
  storage ??= new DexieStorage({ dbName: 'foxycape-pdf' })
  return storage
}

/** Hash and image worker. Created the first time a PDF is opened. */
export const getPdfWorker = (): IGlobalWorker => {
  worker ??= createGlobalWorker()
  return worker
}

export const getLegacyMarkCatalog = (): LegacyMarkCatalog => {
  catalog ??= new LegacyMarkCatalog()
  return catalog
}

/** Open the database and classify leftover mark tables before the first PDF session. */
export const ensurePdfRuntime = async (): Promise<void> => {
  if (!ready) {
    const opening = (async () => {
      const store = getPdfStorage()
      getPdfWorker()
      await getLegacyMarkCatalog().load(store)
    })()
    ready = opening
    try {
      await opening
    } catch (error) {
      if (ready === opening) {
        ready = null
      }
      throw error
    }
    return
  }
  await ready
}

export const disposePdfRuntime = async (): Promise<void> => {
  const currentWorker = worker
  const currentStorage = storage
  worker = null
  storage = null
  catalog = null
  ready = null
  await currentWorker?.dispose()
  await currentStorage?.dispose()
}
