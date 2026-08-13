import type { Plugin } from 'obsidian'
import { EMBEDDED_RUNTIME_ASSETS_BASE64 } from 'virtual:foxycape-embedded-assets'
import {
  EMBEDDED_RUNTIME_MARKERS,
  REMOTE_RUNTIME_MARKERS,
  RUNTIME_ASSETS_ZIP_NAME,
  RUNTIME_CMAPS_ID,
  RUNTIME_CMAPS_VERSION_MARKER,
  buildRuntimeAssetsDownloadUrl,
} from './constants'
import { downloadBinaryWithProgress } from './downloadBinaryWithProgress'
import {
  decodeBase64ToBytes,
  extractZipToPluginDir,
  isEmbeddedZipEntryName,
  isRemoteZipEntryName,
  joinPluginPath,
} from './runtimeAssetZip'

type Translate = (key: string, defaultText: string, named?: object) => string

type EnsureRuntimeAssetsOptions = {
  t?: Translate
}

type Adapter = Plugin['app']['vault']['adapter']

let embeddedPromise: Promise<void> | null = null
let remotePromise: Promise<void> | null = null
let embeddedUnpackedThisSession = false

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

/** True when worker + signer files are on disk (unpacked from main.js this session or copied). */
export const hasEmbeddedRuntimeAssets = async (plugin: Plugin): Promise<boolean> =>
  hasAllMarkerFiles(plugin, EMBEDDED_RUNTIME_MARKERS)

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

/** True when worker, signer, cmaps, and fonts are all on disk for this build. */
export const hasInstalledRuntimeAssets = async (
  plugin: Plugin,
): Promise<boolean> =>
  (await hasEmbeddedRuntimeAssets(plugin)) && (await hasRemoteRuntimeAssets(plugin))

const extractEmbedded = async (plugin: Plugin) => {
  await extractZipToPluginDir(
    plugin,
    decodeBase64ToBytes(EMBEDDED_RUNTIME_ASSETS_BASE64),
    {
      isAllowedEntry: isEmbeddedZipEntryName,
      zipLabel: 'embedded worker+signer',
    },
  )
}

const downloadAndInstallRemote = async (plugin: Plugin, t: Translate) => {
  const url = buildRuntimeAssetsDownloadUrl(plugin.manifest.version)
  const { status, bytes } = await downloadBinaryWithProgress(url)
  if (status !== 200) {
    throw new Error(
      t(
        'plugin_notice_assets_download_failed',
        'Failed to download runtime assets (HTTP {status}).',
        { status: String(status) },
      ),
    )
  }

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

/**
 * Unpack pdf.worker + signer from the copy baked into main.js (no network).
 * Runs once per plugin session so updates replace on-disk files without a marker.
 */
export const ensureEmbeddedRuntimeAssets = async (
  plugin: Plugin,
  options: EnsureRuntimeAssetsOptions = {},
): Promise<void> => {
  void options
  if (embeddedUnpackedThisSession && (await hasEmbeddedRuntimeAssets(plugin))) {
    return
  }

  if (embeddedPromise === null) {
    embeddedPromise = extractEmbedded(plugin)
      .then(async () => {
        if (!(await hasEmbeddedRuntimeAssets(plugin))) {
          throw new Error('Embedded runtime assets are still missing after extract.')
        }
        embeddedUnpackedThisSession = true
      })
      .finally(() => {
        embeddedPromise = null
      })
  }

  await embeddedPromise
}

/**
 * Download cmaps / standard_fonts from the current plugin GitHub Release.
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

  if (remotePromise === null) {
    remotePromise = downloadAndInstallRemote(plugin, t).finally(() => {
      remotePromise = null
    })
  }

  await remotePromise
}

/**
 * Unpack worker / signer from main.js (no network). Cmaps / fonts download
 * in the background and must not block opening a PDF.
 */
export const ensureRuntimeAssets = async (
  plugin: Plugin,
  options: EnsureRuntimeAssetsOptions = {},
): Promise<void> => {
  await ensureEmbeddedRuntimeAssets(plugin, options)
  void ensureRemoteRuntimeAssets(plugin, options).catch((error) => {
    console.warn('[Foxycape PDF] background font download failed', error)
  })
}
