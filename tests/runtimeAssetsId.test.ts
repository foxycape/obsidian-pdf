import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  buildMarkdownLibCdnUrl,
  buildMarkdownLibDownloadUrl,
  buildRuntimeAssetsCdnUrl,
  buildRuntimeAssetsDownloadUrl,
  RUNTIME_CMAPS_ID,
} from '@/assets/constants'
import { resolveFoxycapeCore } from '../scripts/resolveFoxycapeCore'
import { buildLocalesId } from '../scripts/localesId.mjs'
import { buildMarkdownId } from '../scripts/markdownId.mjs'
import { buildPdfjsCmapsId } from '../scripts/runtimeAssetsId.mjs'

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { pdfjsDir } = resolveFoxycapeCore(packageDir)

describe('runtime assets identity', () => {
  it('keys the remote pack by pdf.js version, not plugin semver', () => {
    const { version: pluginVersion } = JSON.parse(
      readFileSync(resolve(packageDir, 'package.json'), 'utf8'),
    ) as { version: string }
    const { version: pdfjsVersion } = JSON.parse(
      readFileSync(resolve(pdfjsDir, 'package.json'), 'utf8'),
    ) as { version: string }

    const localesId = buildLocalesId(resolve(packageDir, 'src/i18n/locales'))

    expect(localesId).toMatch(/^locales-[0-9a-f]{12}$/)
    expect(buildPdfjsCmapsId(pdfjsDir)).not.toBe(pluginVersion)
    expect(buildPdfjsCmapsId(pdfjsDir)).toBe(
      `pdfjs-${pdfjsVersion}`,
    )
    expect(RUNTIME_CMAPS_ID).toBe(`pdfjs-${pdfjsVersion}`)
  })

  it('still downloads the zip from the current plugin GitHub Release tag', () => {
    expect(buildRuntimeAssetsDownloadUrl('3.4.1')).toBe(
      'https://github.com/foxycape/obsidian-pdf/releases/download/3.4.1/pdfjs-assets.zip',
    )
    expect(buildRuntimeAssetsCdnUrl('3.4.1')).toBe(
      'https://cdn.tiefeiying.com/obsidian-pdf/3.4.1/pdfjs-assets.zip',
    )
  })

  it('keys markdown.js by its own content hash', () => {
    expect(buildMarkdownId('katex-and-highlight')).toMatch(/^markdown-[0-9a-f]{12}$/)
    expect(buildMarkdownId('katex-and-highlight')).toBe(buildMarkdownId('katex-and-highlight'))
    expect(buildMarkdownId('other')).not.toBe(buildMarkdownId('katex-and-highlight'))
    expect(buildMarkdownLibDownloadUrl('3.4.4')).toBe(
      'https://github.com/foxycape/obsidian-pdf/releases/download/3.4.4/markdown.js',
    )
    expect(buildMarkdownLibCdnUrl('3.4.4')).toBe(
      'https://cdn.tiefeiying.com/obsidian-pdf/3.4.4/markdown.js',
    )
  })
})
