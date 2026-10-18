import { loadEnv } from 'vite'

/**
 * Vault plugin directory from the process, otherwise from `.env`.
 * Empty when unset. An existing process variable wins over the file.
 * `vite build --watch` uses production mode, so the value belongs in `.env`.
 */
export const readObsidianPluginDir = (packageDir) => {
  const fromProcess = process.env.OBSIDIAN_PLUGIN_DIR?.trim()
  if (fromProcess) {
    return fromProcess
  }

  const fileEnv = loadEnv('production', packageDir, '')
  return fileEnv.OBSIDIAN_PLUGIN_DIR?.trim() ?? ''
}
