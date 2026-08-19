import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'

const require = createRequire(import.meta.url)

export type FoxycapeCoreResolution = {
  /** Absolute path to workspace core / npm package root */
  root: string
  /** True when resolving TypeScript source under ../core */
  isSource: boolean
  /** Absolute path to pdfjs assets (source pdfjs/ or package dist/pdfjs/) */
  pdfjsDir: string
}

/**
 * Workspace `../core` is the single local source of truth.
 * Standalone clones fall back to the installed npm package.
 */
export const resolveFoxycapeCore = (packageDir: string): FoxycapeCoreResolution => {
  const workspaceRoot = resolve(packageDir, '../core')
  if (existsSync(resolve(workspaceRoot, 'package.json'))) {
    return {
      root: workspaceRoot,
      isSource: true,
      pdfjsDir: resolve(workspaceRoot, 'pdfjs'),
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

/** Vite aliases: map @foxycape/core → local TypeScript source when present. */
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
