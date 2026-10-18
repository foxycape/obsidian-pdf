import type { IMarkStorage } from './IMarkStorage'
import type { IReadingProgressStore } from './IReadingProgressStore'
import type { IStorage } from './IStorage'

export { DexieStorage } from './DexieStorage'
export type { IStorage } from './IStorage'
export { DataStorageOptions } from './IStorage'
export type { IMarkStorage } from './IMarkStorage'
export type { IReadingProgressStore } from './IReadingProgressStore'
export { ReadingProgressStore } from './ReadingProgressStore'
export { bindReadingProgress } from './bindReadingProgress'

export type PdfPluginStorage = IStorage & {
  readonly marks: IMarkStorage
  readonly readingProgress: IReadingProgressStore
}

