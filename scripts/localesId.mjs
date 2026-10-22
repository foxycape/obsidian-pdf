import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Content id for locales.zip. Plugin releases that do not change translations
 * keep the same id, so an installed language pack is not downloaded again.
 *
 * @param {string} localesDir Absolute path to src/i18n/locales
 * @returns {string} e.g. `locales-a1b2c3d4e5f6`
 */
export const buildLocalesId = (localesDir) => {
  const names = readdirSync(localesDir)
    .filter((name) => name.endsWith('.json'))
    .sort()
  if (!names.includes('en.json')) {
    throw new Error(`Missing en.json in ${localesDir}`)
  }
  const hash = createHash('sha256')
  for (const name of names) {
    hash.update(name)
    hash.update('\0')
    hash.update(readFileSync(join(localesDir, name)))
  }
  return `locales-${hash.digest('hex').slice(0, 12)}`
}
