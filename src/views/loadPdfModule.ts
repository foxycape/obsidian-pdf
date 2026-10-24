import type { Plugin } from 'obsidian'
import { ensurePdfjsPack, invalidatePdfLib } from '@/assets/ensureRuntimeAssets'
import type { DownloadProgressHandler } from '@/assets/downloadBinaryWithProgress'
import { PDF_LIB_FILE } from '@/assets/constants'
import { joinPluginPath } from '@/assets/runtimeAssetZip'
import {
  FOXYCAPE_PDFJS_LIB_GLOBAL,
  FOXYCAPE_PDFJS_VIEWER_GLOBAL,
} from '@/reader/pdfjsGlobalNames'
import { evaluateObsidianCjs } from '@/views/evaluateObsidianCjs'

const evaluatePdfLib = (source: string): void => {
  evaluateObsidianCjs(source, 'pdf-lib.js')
  const runtime = window as unknown as Window & Record<string, object | undefined>
  if (!runtime[FOXYCAPE_PDFJS_LIB_GLOBAL] || !runtime[FOXYCAPE_PDFJS_VIEWER_GLOBAL]) {
    throw new Error('pdf-lib.js did not install the PDF.js runtime.')
  }
}

let cached: Promise<void> | null = null

const readPdfLibSource = async (plugin: Plugin): Promise<string> => {
  const pluginDir = plugin.manifest.dir
  if (!pluginDir) {
    throw new Error('Plugin directory is unavailable (manifest.dir is empty).')
  }
  return plugin.app.vault.adapter.read(joinPluginPath(pluginDir, PDF_LIB_FILE))
}

/**
 * Download pdfjs.zip when the PDF.js library or worker is missing, then execute pdf-lib.js.
 * reader-bundle.js is executed separately, after these globals exist.
 */
export const loadPdfLib = async (
  plugin: Plugin,
  onProgress?: DownloadProgressHandler,
): Promise<void> => {
  if (cached !== null) {
    await cached
    return
  }
  const translate = (plugin as Plugin & { t?: (key: string, fallback: string) => string }).t
  cached = (async () => {
    await ensurePdfjsPack(plugin, { t: translate, onProgress })
    const source = await readPdfLibSource(plugin)
    try {
      evaluatePdfLib(source)
    } catch (error) {
      await invalidatePdfLib(plugin)
      throw error
    }
  })().catch((error: unknown) => {
    cached = null
    throw error
  })
  await cached
}
