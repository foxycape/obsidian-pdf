import type { Plugin } from 'obsidian'
import {
  PDF_LIB_FILE,
  PDF_LIB_VERSION_MARKER,
  PDFJS_PACK_ZIP_NAME,
  READER_BUNDLE_FILE,
  READER_PACK_ZIP_NAME,
  READER_VERSION_MARKER,
  KATEX_FONTS_DIR,
  REMOTE_RUNTIME_MARKERS,
  RUNTIME_ASSETS_ZIP_NAME,
  RUNTIME_CMAPS_ID,
  RUNTIME_CMAPS_VERSION_MARKER,
  LOCALES_ID,
  LOCALES_ZIP_NAME,
  LOCALES_VERSION_MARKER,
  LOCALE_EN_RELATIVE,
  MARKDOWN_ID,
  MARKDOWN_LIB_FILE,
  MARKDOWN_VERSION_MARKER,
  WORKER_RELATIVE,
  WORKER_VERSION_MARKER,
  buildLocalesCdnUrl,
  buildLocalesDownloadUrl,
  buildMarkdownLibCdnUrl,
  buildMarkdownLibDownloadUrl,
  buildPdfjsPackCdnUrl,
  buildPdfjsPackDownloadUrl,
  buildReaderPackCdnUrl,
  buildReaderPackDownloadUrl,
  buildRuntimeAssetsCdnUrl,
  buildRuntimeAssetsDownloadUrl,
} from './constants'
import {
  downloadBinaryWithProgress,
  type DownloadProgressHandler,
} from './downloadBinaryWithProgress'
import { evaluateMarkdownLib, invalidateMarkdownLibEval } from '@/views/loadMarkdownLib'
import {
  ensureParentDir,
  extractZipToPluginDir,
  isLocalesZipEntryName,
  isPdfjsZipEntryName,
  isReaderZipEntryName,
  isRemoteZipEntryName,
  joinPluginPath,
} from './runtimeAssetZip'

type Translate = (key: string, defaultText: string, named?: object) => string

type EnsureRuntimeAssetsOptions = {
  t?: Translate
  onProgress?: DownloadProgressHandler
}

type Adapter = Plugin['app']['vault']['adapter']

let pdfjsPackPromise: Promise<void> | null = null
let readerPackPromise: Promise<void> | null = null
let localesPromise: Promise<void> | null = null
let remotePromise: Promise<void> | null = null
let markdownPromise: Promise<void> | null = null
const pdfjsPackProgress = new Set<DownloadProgressHandler>()
const readerPackProgress = new Set<DownloadProgressHandler>()

const resolveTranslate = (
  plugin: Plugin,
  options: EnsureRuntimeAssetsOptions,
): Translate => {
  const pluginT = (plugin as Plugin & { t?: Translate }).t
  return (
    options.t ??
    pluginT ??
    ((key, defaultText) => {
      void key
      return defaultText
    })
  )
}

const readMarker = async (
  adapter: Adapter,
  markerPath: string,
): Promise<string | null> => {
  if (!(await adapter.exists(markerPath))) {
    return null
  }
  try {
    return (await adapter.read(markerPath)).trim()
  } catch {
    return null
  }
}

const hasAllMarkerFiles = async (
  plugin: Plugin,
  relatives: readonly string[],
): Promise<boolean> => {
  const pluginDir = plugin.manifest.dir
  if (!pluginDir) {
    return false
  }
  const adapter = plugin.app.vault.adapter
  for (const relative of relatives) {
    if (!(await adapter.exists(joinPluginPath(pluginDir, relative)))) {
      return false
    }
  }
  return true
}

const hasFileWithMarker = async (
  plugin: Plugin,
  relativePath: string,
  markerRelativePath: string,
  expected: string,
): Promise<boolean> => {
  const pluginDir = plugin.manifest.dir
  if (!pluginDir || !expected) {
    return false
  }
  const adapter = plugin.app.vault.adapter
  if (!(await adapter.exists(joinPluginPath(pluginDir, relativePath)))) {
    return false
  }
  const marker = await readMarker(
    adapter,
    joinPluginPath(pluginDir, markerRelativePath),
  )
  return marker === expected
}

const requirePluginDir = (plugin: Plugin): string => {
  const pluginDir = plugin.manifest.dir
  if (!pluginDir) {
    throw new Error('Plugin directory is unavailable (manifest.dir is empty).')
  }
  return pluginDir
}

const downloadHttpError = (t: Translate, status: number) =>
  new Error(
    t(
      'plugin_notice_assets_download_failed',
      'Failed to download runtime assets (HTTP {status}).',
      { status: String(status) },
    ),
  )

/** True when pdf.worker.min.mjs matches this build's pdf.js version. */
export const hasWorkerRuntime = async (
  plugin: Plugin,
  runtimeId = RUNTIME_CMAPS_ID,
): Promise<boolean> =>
  hasFileWithMarker(plugin, WORKER_RELATIVE, WORKER_VERSION_MARKER, runtimeId)

/** True when pdf-lib.js is on disk and tagged with this build's pdf.js version. */
export const hasPdfLib = async (plugin: Plugin): Promise<boolean> =>
  hasFileWithMarker(
    plugin,
    PDF_LIB_FILE,
    PDF_LIB_VERSION_MARKER,
    RUNTIME_CMAPS_ID,
  )

/** Local pdf-lib.js or worker is missing or tagged for another pdf.js build. */
export const pdfjsPackNeedsDownload = async (plugin: Plugin): Promise<boolean> =>
  !(await hasPdfLib(plugin)) || !(await hasWorkerRuntime(plugin))

/** True when reader-bundle.js is tagged with this plugin version and KaTeX fonts are present. */
export const hasReaderBundle = async (plugin: Plugin): Promise<boolean> => {
  if (!(await hasAllMarkerFiles(plugin, [KATEX_FONTS_DIR]))) {
    return false
  }
  return hasFileWithMarker(
    plugin,
    READER_BUNDLE_FILE,
    READER_VERSION_MARKER,
    plugin.manifest.version,
  )
}

/** Local reader bundle is missing or was installed for another plugin version. */
export const readerPackNeedsDownload = async (plugin: Plugin): Promise<boolean> =>
  !(await hasReaderBundle(plugin))

/** Drop the version marker so the next open downloads reader-bundle.zip again. */
export const invalidateReaderPack = async (plugin: Plugin): Promise<void> => {
  const pluginDir = plugin.manifest.dir
  if (!pluginDir) {
    return
  }
  const adapter = plugin.app.vault.adapter as Adapter & {
    remove?: (path: string) => Promise<void>
  }
  const markerPath = joinPluginPath(pluginDir, READER_VERSION_MARKER)
  if (typeof adapter.remove === 'function') {
    try {
      await adapter.remove(markerPath)
    } catch {
      // Marker was already gone.
    }
    return
  }
  if (await adapter.exists(markerPath)) {
    await adapter.write(markerPath, '')
  }
}

const hasEnglishLocale = async (plugin: Plugin): Promise<boolean> => {
  const pluginDir = plugin.manifest.dir
  if (!pluginDir) {
    return false
  }
  return plugin.app.vault.adapter.exists(joinPluginPath(pluginDir, LOCALE_EN_RELATIVE))
}

/** True when language files match this build's locale content id. */
export const hasLocalesPack = async (plugin: Plugin): Promise<boolean> =>
  (await hasEnglishLocale(plugin)) &&
  (await hasFileWithMarker(
    plugin,
    LOCALE_EN_RELATIVE,
    LOCALES_VERSION_MARKER,
    LOCALES_ID,
  ))

/** True when markdown-lib.js matches this build's KaTeX / highlight.js content id. */
export const hasMarkdownPack = async (
  plugin: Plugin,
  markdownId = MARKDOWN_ID,
): Promise<boolean> =>
  hasFileWithMarker(plugin, MARKDOWN_LIB_FILE, MARKDOWN_VERSION_MARKER, markdownId)

/** Drop the version marker so the next open downloads pdfjs.zip again. */
export const invalidatePdfLib = async (plugin: Plugin): Promise<void> => {
  const pluginDir = plugin.manifest.dir
  if (!pluginDir) {
    return
  }
  const adapter = plugin.app.vault.adapter as Adapter & {
    remove?: (path: string) => Promise<void>
  }
  const markerPath = joinPluginPath(pluginDir, PDF_LIB_VERSION_MARKER)
  if (typeof adapter.remove === 'function') {
    try {
      await adapter.remove(markerPath)
    } catch {
      // Marker was already gone.
    }
    return
  }
  if (await adapter.exists(markerPath)) {
    await adapter.write(markerPath, '')
  }
}

export const hasRemoteRuntimeAssets = async (
  plugin: Plugin,
  cmapsId = RUNTIME_CMAPS_ID,
): Promise<boolean> => {
  if (!(await hasAllMarkerFiles(plugin, REMOTE_RUNTIME_MARKERS))) {
    return false
  }
  const pluginDir = plugin.manifest.dir
  if (!pluginDir) {
    return false
  }
  const adapter = plugin.app.vault.adapter
  const remote = await readMarker(
    adapter,
    joinPluginPath(pluginDir, RUNTIME_CMAPS_VERSION_MARKER),
  )
  return remote === cmapsId
}

const downloadBytes = async (
  url: string,
  fallbackUrl: string,
  t: Translate,
  onProgress?: DownloadProgressHandler,
) => {
  const { status, bytes } = await downloadBinaryWithProgress(
    url,
    onProgress,
    undefined,
    { fallbackUrls: [fallbackUrl] },
  )
  if (status !== 200) {
    throw downloadHttpError(t, status)
  }
  if (bytes.byteLength < 32) {
    throw new Error(`Downloaded file from ${url} is empty or invalid.`)
  }
  return bytes
}

const writeTextFile = async (
  plugin: Plugin,
  relativePath: string,
  text: string,
) => {
  const pluginDir = requirePluginDir(plugin)
  const adapter = plugin.app.vault.adapter
  const target = joinPluginPath(pluginDir, relativePath)
  await ensureParentDir(adapter, target)
  await adapter.write(target, text)
}

const emitPdfjsPackProgress: DownloadProgressHandler = (loaded, total) => {
  for (const handler of pdfjsPackProgress) {
    handler(loaded, total)
  }
}

const downloadAndInstallPdfjsPack = async (plugin: Plugin, t: Translate) => {
  const bytes = await downloadBytes(
    buildPdfjsPackDownloadUrl(plugin.manifest.version),
    buildPdfjsPackCdnUrl(plugin.manifest.version),
    t,
    emitPdfjsPackProgress,
  )
  await extractZipToPluginDir(plugin, bytes, {
    isAllowedEntry: isPdfjsZipEntryName,
    zipLabel: PDFJS_PACK_ZIP_NAME,
  })
  await writeTextFile(plugin, PDF_LIB_VERSION_MARKER, `${RUNTIME_CMAPS_ID}\n`)
  await writeTextFile(plugin, WORKER_VERSION_MARKER, `${RUNTIME_CMAPS_ID}\n`)
  if (await pdfjsPackNeedsDownload(plugin)) {
    throw new Error(
      t(
        'plugin_notice_assets_still_missing',
        'Runtime assets are still missing after download.',
      ),
    )
  }
}

const downloadAndInstallRemote = async (plugin: Plugin, t: Translate) => {
  const bytes = await downloadBytes(
    buildRuntimeAssetsDownloadUrl(plugin.manifest.version),
    buildRuntimeAssetsCdnUrl(plugin.manifest.version),
    t,
  )
  if (bytes.byteLength < 64) {
    throw new Error(`Downloaded ${RUNTIME_ASSETS_ZIP_NAME} is empty or invalid.`)
  }

  await extractZipToPluginDir(plugin, bytes, {
    isAllowedEntry: isRemoteZipEntryName,
    markerRelativePath: RUNTIME_CMAPS_VERSION_MARKER,
    markerValue: RUNTIME_CMAPS_ID,
    zipLabel: RUNTIME_ASSETS_ZIP_NAME,
  })

  if (!(await hasRemoteRuntimeAssets(plugin))) {
    throw new Error(
      t(
        'plugin_notice_assets_still_missing',
        'Runtime assets are still missing after download.',
      ),
    )
  }
}

const shareDownload = (
  current: Promise<void> | null,
  setCurrent: (next: Promise<void> | null) => void,
  run: () => Promise<void>,
) => {
  if (current === null) {
    const pending = run().finally(() => {
      setCurrent(null)
    })
    setCurrent(pending)
    return pending
  }
  return current
}

/**
 * Download pdfjs.zip once. Enable, license settings, and the first PDF open share this promise.
 * A later caller can still receive byte progress for a download that is already running.
 */
export const ensurePdfjsPack = async (
  plugin: Plugin,
  options: EnsureRuntimeAssetsOptions = {},
): Promise<void> => {
  if (!(await pdfjsPackNeedsDownload(plugin))) {
    return
  }
  if (options.onProgress) {
    pdfjsPackProgress.add(options.onProgress)
  }
  const t = resolveTranslate(plugin, options)
  try {
    pdfjsPackPromise = shareDownload(pdfjsPackPromise, (next) => {
      pdfjsPackPromise = next
    }, () => downloadAndInstallPdfjsPack(plugin, t))
    await pdfjsPackPromise
  } finally {
    if (options.onProgress) {
      pdfjsPackProgress.delete(options.onProgress)
    }
  }
}

const emitReaderPackProgress: DownloadProgressHandler = (loaded, total) => {
  for (const handler of readerPackProgress) {
    handler(loaded, total)
  }
}

const downloadAndInstallReaderPack = async (plugin: Plugin, t: Translate) => {
  const bytes = await downloadBytes(
    buildReaderPackDownloadUrl(plugin.manifest.version),
    buildReaderPackCdnUrl(plugin.manifest.version),
    t,
    emitReaderPackProgress,
  )
  await extractZipToPluginDir(plugin, bytes, {
    isAllowedEntry: isReaderZipEntryName,
    zipLabel: READER_PACK_ZIP_NAME,
  })
  await writeTextFile(plugin, READER_VERSION_MARKER, `${plugin.manifest.version}\n`)
  if (await readerPackNeedsDownload(plugin)) {
    throw new Error(
      t(
        'plugin_notice_assets_still_missing',
        'Runtime assets are still missing after download.',
      ),
    )
  }
}

/**
 * Download reader-bundle.zip when the plugin version changed.
 * Opening a PDF waits. Plugin enable does not start this download.
 */
export const ensureReaderPack = async (
  plugin: Plugin,
  options: EnsureRuntimeAssetsOptions = {},
): Promise<void> => {
  if (!(await readerPackNeedsDownload(plugin))) {
    return
  }
  if (options.onProgress) {
    readerPackProgress.add(options.onProgress)
  }
  const t = resolveTranslate(plugin, options)
  try {
    readerPackPromise = shareDownload(readerPackPromise, (next) => {
      readerPackPromise = next
    }, () => downloadAndInstallReaderPack(plugin, t))
    await readerPackPromise
  } finally {
    if (options.onProgress) {
      readerPackProgress.delete(options.onProgress)
    }
  }
}

const downloadAndInstallLocales = async (plugin: Plugin, t: Translate) => {
  const bytes = await downloadBytes(
    buildLocalesDownloadUrl(plugin.manifest.version),
    buildLocalesCdnUrl(plugin.manifest.version),
    t,
  )
  await extractZipToPluginDir(plugin, bytes, {
    isAllowedEntry: isLocalesZipEntryName,
    zipLabel: LOCALES_ZIP_NAME,
  })
  await writeTextFile(plugin, LOCALES_VERSION_MARKER, `${LOCALES_ID}\n`)
  if (!(await hasLocalesPack(plugin))) {
    throw new Error(
      t(
        'plugin_notice_assets_still_missing',
        'Runtime assets are still missing after download.',
      ),
    )
  }
}

/** Download locales.zip when the language files are missing or their content id changed. */
export const ensureLocalesPack = async (
  plugin: Plugin,
  options: EnsureRuntimeAssetsOptions = {},
): Promise<void> => {
  if (await hasLocalesPack(plugin)) {
    return
  }
  const t = resolveTranslate(plugin, options)
  localesPromise = shareDownload(localesPromise, (next) => {
    localesPromise = next
  }, () => downloadAndInstallLocales(plugin, t))
  await localesPromise
}

const downloadAndInstallMarkdown = async (plugin: Plugin, t: Translate) => {
  if (!(await hasMarkdownPack(plugin))) {
    invalidateMarkdownLibEval()
    const bytes = await downloadBytes(
      buildMarkdownLibDownloadUrl(plugin.manifest.version),
      buildMarkdownLibCdnUrl(plugin.manifest.version),
      t,
    )
    const text = new TextDecoder().decode(bytes)
    if (text.length < 1000 || text.trimStart().startsWith('<')) {
      throw new Error(`Downloaded ${MARKDOWN_LIB_FILE} is empty or invalid.`)
    }
    await writeTextFile(plugin, MARKDOWN_LIB_FILE, text)
    await writeTextFile(plugin, MARKDOWN_VERSION_MARKER, `${MARKDOWN_ID}\n`)
    if (!(await hasMarkdownPack(plugin))) {
      throw new Error(
        t(
          'plugin_notice_assets_still_missing',
          'Runtime assets are still missing after download.',
        ),
      )
    }
  }
  await evaluateMarkdownLib(plugin)
}

/**
 * Download markdown-lib.js when KaTeX / highlight.js changed.
 * Silent. Does not block plugin startup or opening a PDF.
 */
export const ensureMarkdownPack = async (
  plugin: Plugin,
  options: EnsureRuntimeAssetsOptions = {},
): Promise<void> => {
  const t = resolveTranslate(plugin, options)
  markdownPromise = shareDownload(markdownPromise, (next) => {
    markdownPromise = next
  }, () => downloadAndInstallMarkdown(plugin, t))
  await markdownPromise
}

/**
 * Download cmaps, standard fonts, wasm, and iccs from the current plugin GitHub Release.
 * Silent (no Notice / modal). Safe to call in the background on load.
 */
export const ensureRemoteRuntimeAssets = async (
  plugin: Plugin,
  options: EnsureRuntimeAssetsOptions = {},
): Promise<void> => {
  const t = resolveTranslate(plugin, options)
  if (await hasRemoteRuntimeAssets(plugin)) {
    return
  }

  remotePromise = shareDownload(remotePromise, (next) => {
    remotePromise = next
  }, () => downloadAndInstallRemote(plugin, t))
  await remotePromise
}

/**
 * Start the pdfjs pack if it is still missing, and the background font pack.
 * Callers that must wait (license, opening a PDF) use `ensurePdfjsPack`.
 */
export const ensureRuntimeAssets = async (
  plugin: Plugin,
  options: EnsureRuntimeAssetsOptions = {},
): Promise<void> => {
  void ensurePdfjsPack(plugin, options).catch((error) => {
    console.warn('[Foxycape PDF] pdfjs pack download failed', error)
  })
  void ensureRemoteRuntimeAssets(plugin, options).catch((error) => {
    console.warn('[Foxycape PDF] background font download failed', error)
  })
  void ensureMarkdownPack(plugin, options).catch((error) => {
    console.warn('[Foxycape PDF] markdown runtime download failed', error)
  })
}
