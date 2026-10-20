import type { Plugin } from 'obsidian'
import {
  PDF_BUNDLE_FILE,
  PDF_BUNDLE_VERSION_MARKER,
  PDFJS_PACK_ZIP_NAME,
  REMOTE_RUNTIME_MARKERS,
  RUNTIME_ASSETS_ZIP_NAME,
  RUNTIME_CMAPS_ID,
  RUNTIME_CMAPS_VERSION_MARKER,
  RUNTIME_ID,
  SIGNER_RELATIVE,
  SIGNER_VERSION_MARKER,
  LOCALE_EN_RELATIVE,
  WORKER_RELATIVE,
  WORKER_VERSION_MARKER,
  buildPdfjsPackCdnUrl,
  buildPdfjsPackDownloadUrl,
  buildRuntimeAssetsCdnUrl,
  buildRuntimeAssetsDownloadUrl,
} from './constants'
import {
  downloadBinaryWithProgress,
  type DownloadProgressHandler,
} from './downloadBinaryWithProgress'
import {
  ensureParentDir,
  extractZipToPluginDir,
  isPdfjsZipEntryName,
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
let remotePromise: Promise<void> | null = null
const pdfjsPackProgress = new Set<DownloadProgressHandler>()

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

/** True when signer.js matches this build's runtime id. */
export const hasSignerRuntime = async (
  plugin: Plugin,
  runtimeId = RUNTIME_ID,
): Promise<boolean> =>
  hasFileWithMarker(plugin, SIGNER_RELATIVE, SIGNER_VERSION_MARKER, runtimeId)

/** True when pdf.worker.min.mjs matches this build's runtime id. */
export const hasWorkerRuntime = async (
  plugin: Plugin,
  runtimeId = RUNTIME_ID,
): Promise<boolean> =>
  hasFileWithMarker(plugin, WORKER_RELATIVE, WORKER_VERSION_MARKER, runtimeId)

/** True when pdf.js is on disk and tagged with the current plugin version. */
export const hasPdfBundle = async (plugin: Plugin): Promise<boolean> =>
  hasFileWithMarker(
    plugin,
    PDF_BUNDLE_FILE,
    PDF_BUNDLE_VERSION_MARKER,
    plugin.manifest.version,
  )

/** Local pdf.js, worker, signer, or English locale is missing or tagged for another build. */
export const pdfjsPackNeedsDownload = async (plugin: Plugin): Promise<boolean> =>
  !(await hasPdfBundle(plugin)) ||
  !(await hasWorkerRuntime(plugin)) ||
  !(await hasSignerRuntime(plugin)) ||
  !(await hasEnglishLocale(plugin))

const hasEnglishLocale = async (plugin: Plugin): Promise<boolean> => {
  const pluginDir = plugin.manifest.dir
  if (!pluginDir) {
    return false
  }
  return plugin.app.vault.adapter.exists(joinPluginPath(pluginDir, LOCALE_EN_RELATIVE))
}

/** Drop the version marker so the next open downloads pdfjs.zip again. */
export const invalidatePdfBundle = async (plugin: Plugin): Promise<void> => {
  const pluginDir = plugin.manifest.dir
  if (!pluginDir) {
    return
  }
  const adapter = plugin.app.vault.adapter as Adapter & {
    remove?: (path: string) => Promise<void>
  }
  const markerPath = joinPluginPath(pluginDir, PDF_BUNDLE_VERSION_MARKER)
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
  await writeTextFile(plugin, PDF_BUNDLE_VERSION_MARKER, `${plugin.manifest.version}\n`)
  await writeTextFile(plugin, WORKER_VERSION_MARKER, `${RUNTIME_ID}\n`)
  await writeTextFile(plugin, SIGNER_VERSION_MARKER, `${RUNTIME_ID}\n`)
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

/** Same pack as `ensurePdfjsPack`. License registration waits until signer.js is inside it. */
export const ensureSignerRuntime = ensurePdfjsPack

/**
 * Download cmaps, standard fonts, wasm, iccs, and KaTeX woff2 from the current plugin GitHub Release.
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
}
