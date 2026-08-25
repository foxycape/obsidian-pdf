import {
  computeSimpleId,
  EventNames,
  type OpenOptions,
  type Progress,
  type Reader,
} from '@foxycape/core/kernal'
import type { IStorage } from './IStorage'
import { ReadingProgressStore } from './ReadingProgressStore'

const canComputeSimpleId = (source: unknown): source is Parameters<typeof computeSimpleId>[0] => {
  if (typeof source === 'string') {
    return true
  }
  if (source instanceof ArrayBuffer || source instanceof Uint8Array || source instanceof Blob) {
    return true
  }
  return Boolean(globalThis.FileSystemFileHandle && source instanceof FileSystemFileHandle)
}

export const bindReadingProgress = (reader: Reader, storage: IStorage) => {
  const store = new ReadingProgressStore(storage)
  const onProgress = async (progress: Progress) => {
    const simpleId = reader.context?.simpleId
    if (!simpleId) {
      return
    }
    await store.save(simpleId, progress)
  }
  const onDisposed = () => {
    reader.events.off(EventNames.ProgressChange, onProgress)
    reader.events.off(EventNames.ReaderDisposed, onDisposed)
  }
  reader.events.on(EventNames.ProgressChange, onProgress)
  reader.events.on(EventNames.ReaderDisposed, onDisposed)
}

export const applyStoredReadingProgress = async (
  storage: IStorage,
  source: unknown,
  openOptions: OpenOptions,
): Promise<OpenOptions> => {
  if (openOptions.location != null && openOptions.location !== '') {
    return openOptions
  }
  let simpleId = openOptions.simpleId
  if (!simpleId && canComputeSimpleId(source)) {
    try {
      simpleId = await computeSimpleId(source)
    } catch {
      return openOptions
    }
  }
  if (!simpleId) {
    return openOptions
  }
  const progress = await new ReadingProgressStore(storage).get(simpleId)
  if (progress?.location) {
    openOptions.location = progress.location
    openOptions.simpleId = simpleId
  }
  return openOptions
}
