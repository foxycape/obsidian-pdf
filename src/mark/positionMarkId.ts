import { computeUniqueId } from '@foxycape/core/kernal/common/uuid'
import type { FixedContentRange } from '@foxycape/core/kernal/ContentRange'

export const computePdfPositionMarkId = (
  simpleId: string,
  contentRange: FixedContentRange,
  text: string,
  imageUrl?: string,
): string => {
  const geometryKey = contentRange.geometries
    .map((item) => `${item.pageNumber}:${item.coords.join(',')}`)
    .join('|')
  return computeUniqueId(`${simpleId}|${geometryKey}|${text}|${imageUrl ?? ''}`)
}

/**
 * Highlight, translate, explain, and lookup must call this with the same
 * passage inputs. Feature names are not part of the hash.
 */
export const sharedPassageMarkId = (
  simpleId: string,
  contentRange: FixedContentRange,
  text: string,
): string => computePdfPositionMarkId(simpleId, contentRange, text.trim())
