import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
} from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { Plugin } from 'vite'

const ENTRY_FILES = [
  'main.js',
  'styles.css',
  'manifest.json',
  'versions.json',
  '.hotreload',
] as const

const SIDECAR_DIRS = ['pdfjs', 'static'] as const
const CMAPS_VERSION_FILE = '.foxycape-cmaps-version'

const samePath = (left: string, right: string): boolean => {
  const normalize = (value: string) =>
    resolve(value).replace(/[\\/]+/g, '/').replace(/\/$/, '').toLowerCase()
  return normalize(left) === normalize(right)
}

const readTextIfExists = (path: string): string | null => {
  if (!existsSync(path)) {
    return null
  }
  return readFileSync(path, 'utf8')
}

/** undefined: not a link. null: link whose target could not be read. string: link target. */
const junctionTarget = (dir: string): string | null | undefined => {
  let stat
  try {
    stat = lstatSync(dir)
  } catch {
    return undefined
  }
  if (!stat.isSymbolicLink()) {
    return undefined
  }
  try {
    const raw = readlinkSync(dir).replace(/^\\\\\?\\/, '')
    return resolve(dirname(dir), raw)
  } catch {
    return null
  }
}

/**
 * After a successful `vite build --watch`, copy the plugin build into the
 * Obsidian vault folder from `OBSIDIAN_PLUGIN_DIR`. One-shot `vite build` skips this.
 */
export const copyToVaultPlugin = (outDir: string, vaultPluginDir: string): Plugin => {
  let hasWarnedAboutJunction = false

  return {
    name: 'copy-to-obsidian-vault',
    writeBundle() {
      if (!this.meta.watchMode) {
        return
      }

      const dest = vaultPluginDir.trim()
      if (!dest) {
        return
      }

      const linkedTarget = junctionTarget(dest)
      if (linkedTarget !== undefined) {
        const pointsAtDist = linkedTarget !== null && samePath(linkedTarget, outDir)
        if (pointsAtDist || linkedTarget === null) {
          if (!hasWarnedAboutJunction) {
            hasWarnedAboutJunction = true
            const reason = pointsAtDist
              ? 'it is a junction to dist'
              : 'it is a junction and its target could not be read'
            console.warn(
              `[foxycape-pdf] Skip vault copy: ${dest} (${reason}). Remove the junction to copy files instead.`,
            )
          }
          return
        }
      }

      mkdirSync(dest, { recursive: true })

      for (const name of ENTRY_FILES) {
        const from = resolve(outDir, name)
        if (!existsSync(from)) {
          continue
        }
        cpSync(from, resolve(dest, name))
      }

      const srcVersion = readTextIfExists(resolve(outDir, 'pdfjs', CMAPS_VERSION_FILE))
      const destVersion = readTextIfExists(resolve(dest, 'pdfjs', CMAPS_VERSION_FILE))
      const versionChanged = srcVersion !== destVersion

      for (const name of SIDECAR_DIRS) {
        const from = resolve(outDir, name)
        const target = resolve(dest, name)
        if (!existsSync(from)) {
          continue
        }
        if (existsSync(target) && !versionChanged) {
          continue
        }
        cpSync(from, target, { recursive: true })
      }

      console.log(`[foxycape-pdf] Copied build to ${dest}`)
    },
  }
}
