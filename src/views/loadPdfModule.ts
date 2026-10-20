import * as obsidian from 'obsidian'
import type { Plugin } from 'obsidian'
import { ensurePdfjsPack, invalidatePdfBundle } from '@/assets/ensureRuntimeAssets'
import type { DownloadProgressHandler } from '@/assets/downloadBinaryWithProgress'
import { PDF_BUNDLE_FILE } from '@/assets/constants'
import { joinPluginPath } from '@/assets/runtimeAssetZip'
import type { PdfBundleModule } from '@/views/pdfBundleModule'

export type { PdfBundleModule } from '@/views/pdfBundleModule'

type BundlePlugin = Plugin & {
  bindLoadedPdfModule?: (mod: PdfBundleModule) => void
}

const nodeRequire = (id: string): unknown => {
  const requireFn = (window as Window & { require?: (moduleId: string) => unknown }).require
  if (typeof requireFn !== 'function') {
    throw new Error(`Cannot require("${id}") from pdf.js`)
  }
  return requireFn(id)
}

const requireFromPdfBundle = (id: string): unknown => {
  if (id === 'obsidian') {
    return obsidian
  }
  if (id === 'electron' || id === '@codemirror/state' || id === '@codemirror/view') {
    return nodeRequire(id)
  }
  throw new Error(`Cannot require("${id}") from pdf.js`)
}

const evaluatePdfBundle = (source: string): PdfBundleModule => {
  const moduleRef: { exports: PdfBundleModule | { default?: PdfBundleModule } } = {
    exports: {},
  }
  const run = new Function(
    'exports',
    'require',
    'module',
    source,
  ) as (
    exports: unknown,
    require: (id: string) => unknown,
    module: { exports: unknown },
  ) => void
  run(moduleRef.exports, requireFromPdfBundle, moduleRef)
  const exported = moduleRef.exports as PdfBundleModule & { default?: PdfBundleModule }
  const api = exported.default ?? exported
  if (typeof api.attachPdfReader !== 'function') {
    throw new Error('pdf.js did not export the reader.')
  }
  return api
}

let cached: Promise<PdfBundleModule> | null = null
let cachedVersion = ''

const readPdfBundleSource = async (plugin: Plugin): Promise<string> => {
  const pluginDir = plugin.manifest.dir
  if (!pluginDir) {
    throw new Error('Plugin directory is unavailable (manifest.dir is empty).')
  }
  return plugin.app.vault.adapter.read(joinPluginPath(pluginDir, PDF_BUNDLE_FILE))
}

const loadFresh = async (
  plugin: BundlePlugin,
  onProgress?: DownloadProgressHandler,
): Promise<PdfBundleModule> => {
  const translate = (plugin as BundlePlugin & { t?: (key: string, fallback: string) => string }).t
  await ensurePdfjsPack(plugin, { t: translate, onProgress })
  const source = await readPdfBundleSource(plugin)
  try {
    const api = evaluatePdfBundle(source)
    plugin.bindLoadedPdfModule?.(api)
    return api
  } catch (error) {
    await invalidatePdfBundle(plugin)
    throw error
  }
}

/**
 * Download pdfjs.zip when needed, then execute pdf.js the same way Obsidian runs main.js.
 * A failed attempt clears the cache so retry can run again.
 */
export const loadPdfModule = (
  plugin: BundlePlugin,
  onProgress?: DownloadProgressHandler,
): Promise<PdfBundleModule> => {
  const version = plugin.manifest.version
  if (cached && cachedVersion === version) {
    return cached
  }
  cachedVersion = version
  cached = loadFresh(plugin, onProgress).catch((error: unknown) => {
    cached = null
    cachedVersion = ''
    throw error
  })
  return cached
}
