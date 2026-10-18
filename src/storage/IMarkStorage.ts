import type { Mark } from '@/mark/Mark'

/**
 * Structured mark store. Rows are keyed by owner and mark id, and listed by simpleId.
 * This plugin has no account, so callers pass an empty ownerId.
 */
export type IMarkStorage = {
  get: (ownerId: string, markId: string) => Promise<Mark | undefined>
  put: (ownerId: string, mark: Mark) => Promise<void>
  delete: (ownerId: string, markId: string) => Promise<void>
  listByResource: (ownerId: string, simpleId: string) => Promise<Mark[]>
}
