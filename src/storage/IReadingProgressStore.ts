import type { Progress } from '@foxycape/core/kernal'

export type IReadingProgressStore = {
  save(resourceId: string, progress: Progress): Promise<void>
  delete(resourceId: string): Promise<void>
  get(resourceId: string): Promise<Progress | undefined>
}
