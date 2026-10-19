/** Compact token count, matching the reader labels (1.2M / 100K). */
export const formatTokenAmount = (count: number): string => {
  if (!Number.isFinite(count) || count <= 0) {
    return '0'
  }
  if (count >= 1_000_000) {
    const rounded = Math.round((count / 1_000_000) * 10) / 10
    return (Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)) + 'M'
  }
  if (count >= 1000) {
    const rounded = Math.round((count / 1000) * 10) / 10
    return (Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)) + 'K'
  }
  return String(Math.round(count))
}
