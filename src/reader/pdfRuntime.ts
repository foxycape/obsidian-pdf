import { LegacyMarkCatalog } from '@/storage/legacy/LegacyMarkCatalog'
import type { DexieStorage } from '@/storage/DexieStorage'
import type { IGlobalWorker } from '@/workers/IGlobalWorker'
import { readPdfHost } from './pdfHostBridge'

let catalog: LegacyMarkCatalog | null = null
let ready: Promise<void> | null = null

/** Storage constructed when this bundle installs the host. */
export const getPdfStorage = (): DexieStorage => readPdfHost().getStorage()

/** Worker constructed when this bundle installs the host. */
export const getPdfWorker = (): IGlobalWorker => readPdfHost().getWorker()

export const getLegacyMarkCatalog = (): LegacyMarkCatalog => {
  catalog ??= new LegacyMarkCatalog()
  return catalog
}

/** Open the database and classify leftover mark tables before the first PDF session. */
export const ensurePdfRuntime = async (): Promise<void> => {
  if (ready === null) {
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
  catalog = null
  ready = null
  await readPdfHost().dispose()
}
