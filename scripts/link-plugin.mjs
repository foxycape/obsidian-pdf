import { existsSync, lstatSync, readlinkSync, renameSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const distPath = resolve(repoRoot, 'dist')
const pluginId = 'foxycape-pdf'
const vaultPluginPath = resolve(
  process.env.OBSIDIAN_PLUGIN_DIR ??
    `E:\\obsidian\\foxycape-pdf-vault\\.obsidian\\plugins\\${pluginId}`,
)

if (!existsSync(distPath)) {
  console.error(`dist not found: ${distPath}`)
  console.error('Run npm run build first.')
  process.exit(1)
}

if (existsSync(vaultPluginPath)) {
  try {
    const stat = lstatSync(vaultPluginPath)
    if (stat.isSymbolicLink() || stat.isDirectory()) {
      let currentTarget = null
      try {
        currentTarget = resolve(readlinkSync(vaultPluginPath))
      } catch {
        const out = spawnSync(
          'powershell',
          [
            '-NoProfile',
            '-Command',
            `(Get-Item -Force '${vaultPluginPath}').Target`,
          ],
          { encoding: 'utf8' },
        )
        const target = (out.stdout || '').trim()
        if (target) {
          currentTarget = resolve(target.split(/\r?\n/)[0])
        }
      }

      if (currentTarget && resolve(currentTarget) === distPath) {
        console.log(`Already linked:\n  ${vaultPluginPath}\n  -> ${distPath}`)
        process.exit(0)
      }
    }
  } catch {
    // fall through and recreate
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backup = `${vaultPluginPath}.bak-${stamp}`
  renameSync(vaultPluginPath, backup)
  console.log(`Backed up existing folder to ${backup}`)
}

const result = spawnSync('cmd', ['/c', 'mklink', '/J', vaultPluginPath, distPath], {
  stdio: 'inherit',
  shell: false,
})

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

console.log(`Linked:\n  ${vaultPluginPath}\n  -> ${distPath}`)
console.log('Next: npm run dev, then enable Hot Reload + Foxycape PDF in Obsidian.')
