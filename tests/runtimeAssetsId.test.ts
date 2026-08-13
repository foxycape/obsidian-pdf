import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildRuntimeAssetsDownloadUrl, RUNTIME_ASSETS_ID } from '@/assets/constants'
import { buildRuntimeAssetsId } from '../scripts/runtimeAssetsId.mjs'

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')

describe('runtime assets identity', () => {
  it('is derived from pdf.js version and signer contents, not plugin semver', () => {
    const { version: pluginVersion } = JSON.parse(
      readFileSync(resolve(packageDir, 'package.json'), 'utf8'),
    ) as { version: string }
    const { version: pdfjsVersion } = JSON.parse(
      readFileSync(resolve(packageDir, 'vendor/core/pdfjs/package.json'), 'utf8'),
    ) as { version: string }

    const assetsId = buildRuntimeAssetsId(
      resolve(packageDir, 'vendor/core/pdfjs'),
      resolve(packageDir, 'static/signer.js'),
    )
    const escapedPdfjs = pdfjsVersion.replace(/\./g, '\\.')

    expect(assetsId).toBe(RUNTIME_ASSETS_ID)
    expect(assetsId).toMatch(new RegExp(`^pdfjs-${escapedPdfjs}\\+signer-[0-9a-f]{8}$`))
    expect(assetsId).not.toBe(pluginVersion)
  })

  it('still downloads the zip from the current plugin GitHub Release tag', () => {
    expect(buildRuntimeAssetsDownloadUrl('3.4.1')).toBe(
      'https://github.com/foxycape/obsidian-pdf/releases/download/3.4.1/foxycape-pdf-assets.zip',
    )
  })
})
