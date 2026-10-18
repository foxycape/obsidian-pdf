export const ANONYMOUS_OWNER_ID = ''

export const formatOwnerId = (ownerId: string | undefined): string => {
  if (ownerId == null || ownerId === 'undefined') {
    return ANONYMOUS_OWNER_ID
  }
  return String(ownerId)
}
