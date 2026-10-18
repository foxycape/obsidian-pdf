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
