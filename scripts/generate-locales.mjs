import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  FIXED_ENTRIES,
  KEY_ORDER,
  LANGUAGE_CODES,
  LANGUAGE_META,
  TRANSLATIONS,
} from './locale-data.mjs'
import { TRANSLATIONS_EXTRA } from './locale-data-extra.mjs'
import { TRANSLATIONS_UI } from './locale-data-ui.mjs'

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const localesDir = resolve(packageDir, 'src/i18n/locales')
const supportedPath = resolve(packageDir, 'src/i18n/supported_languages.json')

const mergeLang = (code) => ({
  ...(TRANSLATIONS[code] ?? {}),
  ...(TRANSLATIONS_EXTRA[code] ?? {}),
  ...(TRANSLATIONS_UI[code] ?? {}),
})

const allTranslations = Object.fromEntries(
  LANGUAGE_CODES.map((code) => [code, mergeLang(code)]),
)

const buildLocale = (code) => {
  const strings = allTranslations[code]
  if (!strings || Object.keys(strings).length === 0) {
    throw new Error(`Missing translations for language: ${code}`)
  }
  const locale = {}
  for (const key of KEY_ORDER) {
    if (key in FIXED_ENTRIES) {
      locale[key] = FIXED_ENTRIES[key]
    } else if (key in strings) {
      locale[key] = strings[key]
    } else {
      throw new Error(`Missing key "${key}" for language "${code}"`)
    }
  }
  return locale
}

mkdirSync(localesDir, { recursive: true })

let written = 0
for (const code of LANGUAGE_CODES) {
  const locale = buildLocale(code)
  const keys = Object.keys(locale)
  if (keys.length !== KEY_ORDER.length) {
    throw new Error(`${code}.json has ${keys.length} keys, expected ${KEY_ORDER.length}`)
  }
  const extra = keys.filter((k) => !KEY_ORDER.includes(k))
  if (extra.length) {
    throw new Error(`${code}.json has extra keys: ${extra.join(', ')}`)
  }
  writeFileSync(resolve(localesDir, `${code}.json`), `${JSON.stringify(locale, null, 2)}\n`)
  written++
}

const supported = LANGUAGE_META.map(({ code, title, nativeTitle, dir }) => {
  const entry = { code, title, nativeTitle }
  if (dir) {
    entry.dir = dir
  } else {
    entry.dir = 'ltr'
  }
  return entry
})

writeFileSync(supportedPath, `${JSON.stringify(supported, null, 2)}\n`)

const enRef = buildLocale('en')
const refKeys = new Set(Object.keys(enRef))
let parityOk = true
const errors = []

for (const code of LANGUAGE_CODES) {
  const filePath = resolve(localesDir, `${code}.json`)
  const parsed = JSON.parse(readFileSync(filePath, 'utf8'))
  const keys = Object.keys(parsed)
  const keySet = new Set(keys)
  if (keys.length !== refKeys.size) {
    parityOk = false
    errors.push(`${code}: key count ${keys.length} !== ${refKeys.size}`)
  }
  for (const key of refKeys) {
    if (!keySet.has(key)) {
      parityOk = false
      errors.push(`${code}: missing key ${key}`)
    }
  }
  for (const key of keys) {
    if (!refKeys.has(key)) {
      parityOk = false
      errors.push(`${code}: extra key ${key}`)
    }
  }
}

const onDisk = readdirSync(localesDir).filter((f) => f.endsWith('.json'))
if (onDisk.length !== LANGUAGE_CODES.length) {
  parityOk = false
  errors.push(`file count ${onDisk.length} !== ${LANGUAGE_CODES.length}`)
}

console.log(`Wrote ${written} locale files to ${localesDir}`)
console.log(`Wrote ${supportedPath}`)
console.log(`Key parity check: ${parityOk ? 'PASSED' : 'FAILED'}`)
if (errors.length) {
  for (const err of errors) {
    console.error(`  - ${err}`)
  }
  process.exit(1)
}
