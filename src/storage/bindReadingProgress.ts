import {
  EventNames,
  type Progress,
  type Reader,
} from '@foxycape/core/kernal'
import type { IReadingProgressStore } from './IReadingProgressStore'

export const bindReadingProgress = (reader: Reader, store: IReadingProgressStore) => {
  reader.onLocationRequest = async (simpleId) => {
    const progress = await store.get(simpleId)
    return progress?.location
  }
  const onProgress = async (progress: Progress) => {
    const simpleId = reader.context?.id
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
