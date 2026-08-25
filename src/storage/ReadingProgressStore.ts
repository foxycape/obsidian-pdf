import type { Progress } from '@foxycape/core/kernal'
import type { IStorage } from './IStorage'
import type { IReadingProgressStore } from './IReadingProgressStore'

export class ReadingProgressStore implements IReadingProgressStore {
  private readonly storageKey = 'readingProgress'
  constructor(private readonly storage: IStorage) {
  }
  async save(resourceId: string, progress: Progress): Promise<void> {
    await this.storage.set(this.storageKey, resourceId, progress)
  }
  async delete(resourceId: string): Promise<void> {
    await this.storage.delete(this.storageKey, resourceId)
  }
  async get(resourceId: string): Promise<Progress | undefined> {
    return await this.storage.get<Progress>(this.storageKey, resourceId)
  }
}
