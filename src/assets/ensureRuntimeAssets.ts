import { unzipSync } from 'fflate'
import { normalizePath, requestUrl, type Plugin } from 'obsidian'
import {
  RUNTIME_ASSETS_ID,
  RUNTIME_ASSETS_MARKERS,
  RUNTIME_ASSETS_SIZE_HINT,
  RUNTIME_ASSETS_VERSION_MARKER,
  RUNTIME_ASSETS_ZIP_NAME,
  buildRuntimeAssetsDownloadUrl,
} from './constants'
import {
  showRuntimeAssetsModal,
  type RuntimeAssetsProgressUi,
} from '@/ui/RuntimeAssetsModal'

type Translate = (key: string, defaultText: string, named?: object) => string

type EnsureRuntimeAssetsOptions = {
  t?: Translate
}

let ensurePromise: Promise<void> | null = null

const joinPluginPath = (pluginDir: string, relativePath: string) =>
  normalizePath(`${pluginDir}/${relativePath}`)

const ensureParentDir = async (
  adapter: Plugin['app']['vault']['adapter'],
  filePath: string,
) => {
  const parts = filePath.split('/')
  parts.pop()
  let current = ''
  for (const part of parts) {
    if (!part) {
      continue
    }
    current = current ? `${current}/${part}` : part
    if (!(await adapter.exists(current))) {
      await adapter.mkdir(current)
    }
  }
}

export const hasInstalledRuntimeAssets = async (
  plugin: Plugin,
  assetsId = RUNTIME_ASSETS_ID,
): Promise<boolean> => {
  const pluginDir = plugin.manifest.dir
  if (!pluginDir) {
    return false
  }
  const adapter = plugin.app.vault.adapter
  const markerPath = joinPluginPath(pluginDir, RUNTIME_ASSETS_VERSION_MARKER)
  if (!(await adapter.exists(markerPath))) {
    return false
  }
  try {
    const installed = (await adapter.read(markerPath)).trim()
    if (installed !== assetsId) {
      return false
    }
  } catch {
    return false
  }

  for (const relative of RUNTIME_ASSETS_MARKERS) {
    if (!(await adapter.exists(joinPluginPath(pluginDir, relative)))) {
      return false
    }
  }
  return true
}

const isSafeZipEntryName = (name: string): boolean => {
  if (!name || name.endsWith('/')) {
    return false
  }
  const normalized = name.replace(/\\/g, '/')
  if (normalized.startsWith('/') || normalized.includes('..')) {
    return false
  }
  return (
    normalized === 'pdfjs/pdf.worker.min.mjs' ||
    normalized.startsWith('pdfjs/cmaps/') ||
    normalized.startsWith('pdfjs/standard_fonts/') ||
    normalized === 'static/signer.js'
  )
}

const extractZipToPluginDir = async (
  plugin: Plugin,
  zipBytes: Uint8Array,
  onProgress?: (current: number, total: number) => void,
) => {
  const pluginDir = plugin.manifest.dir
  if (!pluginDir) {
    throw new Error('Plugin directory is unavailable (manifest.dir is empty).')
  }

  const adapter = plugin.app.vault.adapter
  const entries = unzipSync(zipBytes)
  const files = Object.entries(entries).filter(([rawName]) =>
    isSafeZipEntryName(rawName.replace(/\\/g, '/')),
  )
  const total = files.length
  let written = 0

  for (const [rawName, data] of files) {
    const name = rawName.replace(/\\/g, '/')
    const target = joinPluginPath(pluginDir, name)
    await ensureParentDir(adapter, target)
    await adapter.writeBinary(
      target,
      data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    )
    written += 1
    onProgress?.(written, total)
  }

  if (written === 0) {
    throw new Error(`No usable files found in ${RUNTIME_ASSETS_ZIP_NAME}.`)
  }

  const markerPath = joinPluginPath(pluginDir, RUNTIME_ASSETS_VERSION_MARKER)
  await ensureParentDir(adapter, markerPath)
  await adapter.write(markerPath, `${RUNTIME_ASSETS_ID}\n`)
}

const downloadAndInstall = async (
  plugin: Plugin,
  t: Translate,
  ui: RuntimeAssetsProgressUi,
) => {
  const url = buildRuntimeAssetsDownloadUrl(plugin.manifest.version)

  ui.setDownloading()
  const response = await requestUrl({ url, throw: false })
  if (response.status !== 200) {
    throw new Error(
      t(
        'plugin_notice_assets_download_failed',
        'Failed to download runtime assets (HTTP {status}).',
        { status: String(response.status) },
      ),
    )
  }

  const bytes = new Uint8Array(response.arrayBuffer)
  if (bytes.byteLength < 64) {
    throw new Error(`Downloaded ${RUNTIME_ASSETS_ZIP_NAME} is empty or invalid.`)
  }

  ui.setInstalling(0, 1)
  await extractZipToPluginDir(plugin, bytes, ui.setInstalling)
}

/**
 * Ensure pdf.worker / cmaps / standard_fonts / signer exist under the plugin dir.
 * Community installs only ship main.js / styles.css / manifest.json; the zip is
 * fetched from the current plugin GitHub Release when the on-disk assets id
 * (pdf.js + signer) does not match this build — typically first PDF open, not
 * every plugin upgrade.
 */
export const ensureRuntimeAssets = async (
  plugin: Plugin,
  options: EnsureRuntimeAssetsOptions = {},
): Promise<void> => {
  const pluginT = (plugin as Plugin & { t?: Translate }).t
  const t: Translate =
    options.t ??
    pluginT ??
    ((key, defaultText) => {
      void key
      return defaultText
    })

  if (await hasInstalledRuntimeAssets(plugin)) {
    return
  }

  if (ensurePromise === null) {
    ensurePromise = showRuntimeAssetsModal({
      app: plugin.app,
      t,
      sizeHint: RUNTIME_ASSETS_SIZE_HINT,
      run: (ui) => downloadAndInstall(plugin, t, ui),
    })
      .then(async () => {
        if (!(await hasInstalledRuntimeAssets(plugin))) {
          throw new Error(
            t(
              'plugin_notice_assets_still_missing',
              'Runtime assets are still missing after download.',
            ),
          )
        }
      })
      .finally(() => {
        ensurePromise = null
      })
  }

  await ensurePromise
}
