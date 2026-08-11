import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

const packageDir = fileURLToPath(new URL('.', import.meta.url))
const webStorageStub = resolve(packageDir, 'scripts/vite/web-storage-stub.ts')

const DYNAMIC_SCRIPT_RE = /createElement\(\s*['"`]script['"`]\s*\)/

const isVendorWebStorage = (id: string) => {
  const normalized = id.split('?')[0].replace(/\\/g, '/')
  return (
    normalized.endsWith('/kernal/storage/WebStorage.ts') ||
    normalized.endsWith('/kernal/storage/WebStorage.js')
  )
}

/**
 * Keep localforage (and its IE <script> setImmediate shim) out of the Obsidian
 * bundle. Storage is provided by DexieStorage via CoreServices.
 */
export const stubVendorWebStoragePlugin = (): Plugin => ({
  name: 'stub-vendor-web-storage',
  enforce: 'pre',
  resolveId(id, importer) {
    if (id === 'localforage') {
      return '\0localforage-stub'
    }
    if (isVendorWebStorage(id)) {
      return webStorageStub
    }
    if (!importer) {
      return null
    }
    // Relative imports from ServiceCollection: ../storage/WebStorage
    if (
      id.includes('storage/WebStorage') ||
      id.replace(/\\/g, '/').endsWith('/storage/WebStorage')
    ) {
      return webStorageStub
    }
    return null
  },
  load(id) {
    if (id === '\0localforage-stub') {
      return 'export default {}'
    }
    return null
  },
})

export const assertNoDynamicScriptElementsPlugin = (mainJsPath: string): Plugin => ({
  name: 'assert-no-dynamic-script-elements',
  writeBundle() {
    const code = readFileSync(mainJsPath, 'utf8')
    const matches = code.match(new RegExp(DYNAMIC_SCRIPT_RE.source, 'g')) ?? []
    if (matches.length > 0) {
      throw new Error(
        `[foxycape-pdf] ${mainJsPath} still contains ${matches.length} dynamic ` +
          '<script> element creation(s). Obsidian review will reject this bundle.',
      )
    }
  },
})
