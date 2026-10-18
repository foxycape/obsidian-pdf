export type LegacyMarkTableSets = {
  md5: string[]
  sha1: string[]
}

const MARK_HASH = /^mark-([0-9a-f]+)$/

/** Split leftover KV mark tables by hex length. MD5 is 32, SHA-1 is 40. */
export const classifyLegacyMarkTables = (names: readonly string[]): LegacyMarkTableSets => {
  const md5: string[] = []
  const sha1: string[] = []
  for (const raw of names) {
    const name = String(raw).toLowerCase()
    const match = MARK_HASH.exec(name)
    if (!match) {
      continue
    }
    if (match[1].length === 32) {
      md5.push(name)
    } else if (match[1].length === 40) {
      sha1.push(name)
    }
  }
  return { md5, sha1 }
}
