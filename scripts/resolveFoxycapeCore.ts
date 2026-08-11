import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'

const require = createRequire(import.meta.url)

export type FoxycapeCoreResolution = {
  /** Absolute path to package / vendor root */
  root: string
  /** Prefer TypeScript source under vendor/core when present */
  isSource: boolean
  /** Absolute path to pdfjs assets (source pdfjs/ or package dist/pdfjs/) */
  pdfjsDir: string
}

/**
 * Local vendor/core wins for source editing; otherwise resolve the installed package.
 */
export const resolveFoxycapeCore = (packageDir: string): FoxycapeCoreResolution => {
  const vendorRoot = resolve(packageDir, 'vendor/core')
  if (existsSync(resolve(vendorRoot, 'package.json'))) {
    return {
      root: vendorRoot,
      isSource: true,
      pdfjsDir: resolve(vendorRoot, 'pdfjs'),
    }
  }

  const pkgJson = require.resolve('@foxycape/core/package.json', {
    paths: [packageDir],
  })
  const root = dirname(pkgJson)
  const distPdfjs = resolve(root, 'dist/pdfjs')
  const rootPdfjs = resolve(root, 'pdfjs')
  return {
    root,
    isSource: false,
    pdfjsDir: existsSync(distPdfjs) ? distPdfjs : rootPdfjs,
  }
}

/** Vite aliases: map @foxycape/core → local source when vendor/core is present. */
export const createFoxycapeCoreAliases = (
  packageDir: string,
): Array<{ find: RegExp | string; replacement: string }> => {
  const { root, isSource } = resolveFoxycapeCore(packageDir)
  if (!isSource) {
    return []
  }

  const normalizedRoot = root.replace(/\\/g, '/')
  return [
    {
      find: /^@foxycape\/core$/,
      replacement: resolve(root, 'kernal/index.ts'),
    },
    {
      find: /^@foxycape\/core\/(.*)/,
      replacement: `${normalizedRoot}/$1`,
    },
  ]
}
