import type { Progress } from '@foxycape/core/kernal'

export type IReadingProgressStore = {
  save(simpleId: string, progress: Progress): Promise<void>
  delete(simpleId: string): Promise<void>
  get(simpleId: string): Promise<Progress | undefined>
}
