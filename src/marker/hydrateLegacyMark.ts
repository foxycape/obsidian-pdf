import { getFixedContentRange, type Mark, type Note } from '@/mark/Mark'

type LegacyTimeFields = {
  createTime?: string | number
  updateTime?: string | number
  createdAt?: number
  updatedAt?: number
}

const toEpochMs = (value: string | number | undefined): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value) {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? undefined : parsed
  }
  return undefined
}

const normalizeTimes = <T extends LegacyTimeFields>(item: T): T => {
  const createdAt = item.createdAt ?? toEpochMs(item.createTime) ?? Date.now()
  const updatedAt = item.updatedAt ?? toEpochMs(item.updateTime) ?? createdAt
  item.createdAt = createdAt
  item.updatedAt = updatedAt
  delete item.createTime
  delete item.updateTime
  return item
}

type LegacyMark = Mark & { resourceId?: string; simpleId?: string }

/** Fill pageNumber, map resourceId onto simpleId, and migrate ISO times. */
export const hydrateLegacyMark = (mark: LegacyMark): Mark => {
  if (!mark.simpleId && mark.resourceId) {
    mark.simpleId = mark.resourceId
  }
  delete mark.resourceId
  if (mark.pageNumber == null) {
    const pageNumber = getFixedContentRange(mark)?.geometries[0]?.pageNumber
    if (pageNumber != null) {
      mark.pageNumber = pageNumber
    }
  }
  normalizeTimes(mark as Mark & LegacyTimeFields)
  mark.notes?.forEach((note) => normalizeTimes(note as Note & LegacyTimeFields))
  return mark as Mark
}
