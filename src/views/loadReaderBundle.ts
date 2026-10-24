import type { Plugin } from 'obsidian'
import { ensureReaderPack, invalidateReaderPack } from '@/assets/ensureRuntimeAssets'
import { READER_BUNDLE_FILE } from '@/assets/constants'
import { joinPluginPath } from '@/assets/runtimeAssetZip'
import { disposeInstalledPdfHost } from '@/reader/pdfHostBridge'
import type readerBundle from '@/pdf-entry'
import { evaluateObsidianCjs } from '@/views/evaluateObsidianCjs'

type ReaderBundle = typeof readerBundle

const isReaderBundle = (value: unknown): value is ReaderBundle =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as ReaderBundle).attachPdfReader === 'function'

let cached: Promise<ReaderBundle> | null = null

const readReaderSource = async (plugin: Plugin): Promise<string> => {
  const pluginDir = plugin.manifest.dir
  if (!pluginDir) {
    throw new Error('Plugin directory is unavailable (manifest.dir is empty).')
  }
  return plugin.app.vault.adapter.read(joinPluginPath(pluginDir, READER_BUNDLE_FILE))
}

const evaluateReaderBundle = (source: string): ReaderBundle => {
  const exported = evaluateObsidianCjs(source, 'the reader bundle')
  if (isReaderBundle(exported)) {
    return exported
  }
  if (
    typeof exported === 'object' &&
    exported !== null &&
    'default' in exported &&
    isReaderBundle(exported.default)
  ) {
    return exported.default
  }
  throw new Error('Reader bundle did not export attachPdfReader.')
}

/**
 * Download reader-bundle.zip when this plugin version is not installed, then execute
 * reader-bundle.js. Call only after pdf-lib.js has installed the PDF.js globals.
 */
export const loadReaderBundle = (plugin: Plugin): Promise<ReaderBundle> => {
  if (cached !== null) {
    return cached
  }
  const translate = (plugin as Plugin & { t?: (key: string, fallback: string) => string }).t
  cached = (async () => {
    await ensureReaderPack(plugin, { t: translate })
    const source = await readReaderSource(plugin)
    try {
      return evaluateReaderBundle(source)
    } catch (error) {
      await disposeInstalledPdfHost()
      await invalidateReaderPack(plugin)
      throw error
    }
  })().catch((error: unknown) => {
    cached = null
    throw error
  })
  return cached
}
