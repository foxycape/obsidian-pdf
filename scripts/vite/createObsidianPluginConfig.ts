import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig, type Plugin, type UserConfig } from 'vite'
import { createFoxycapeCoreAliases } from '../resolveFoxycapeCore'

type CreateObsidianPluginConfigOptions = {
  packageDir: string
  entry?: string
  aliases?: Record<string, string>
  /** Build output folder relative to packageDir. Default: dist */
  outDirName?: string
}

type ObsidianManifest = {
  version: string
  minAppVersion?: string
  [key: string]: unknown
}

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T

const writeJsonIfChanged = (path: string, value: unknown): void => {
  const next = `${JSON.stringify(value, null, 2)}\n`
  if (existsSync(path) && readFileSync(path, 'utf8') === next) {
    return
  }
  writeFileSync(path, next)
}

/**
 * Keep Obsidian manifest/versions in sync with package.json version (source of truth).
 * Writes both package source files and dist copies used by Obsidian.
 */
const syncObsidianManifestVersion = (packageDir: string, outDir: string): void => {
  const packageJsonPath = resolve(packageDir, 'package.json')
  const manifestPath = resolve(packageDir, 'manifest.json')
  if (!existsSync(packageJsonPath) || !existsSync(manifestPath)) {
    return
  }

  const { version } = readJson<{ version: string }>(packageJsonPath)
  const manifest = readJson<ObsidianManifest>(manifestPath)
  manifest.version = version
  writeJsonIfChanged(manifestPath, manifest)

  mkdirSync(outDir, { recursive: true })
  writeJsonIfChanged(resolve(outDir, 'manifest.json'), manifest)

  const versionsPath = resolve(packageDir, 'versions.json')
  if (!existsSync(versionsPath)) {
    return
  }

  const versions = readJson<Record<string, string>>(versionsPath)
  const minAppVersion = manifest.minAppVersion ?? '0.0.0'
  if (versions[version] !== minAppVersion) {
    versions[version] = minAppVersion
    writeJsonIfChanged(versionsPath, versions)
  }
  writeJsonIfChanged(resolve(outDir, 'versions.json'), versions)
}

const copyPluginManifestPlugin = (packageDir: string, outDir: string): Plugin => ({
  name: 'copy-obsidian-manifest',
  writeBundle() {
    syncObsidianManifestVersion(packageDir, outDir)
    // Marks this plugin for pjeby's Hot Reload community plugin.
    writeFileSync(resolve(outDir, '.hotreload'), '')
  },
})

export const createObsidianPluginConfig = (
  options: CreateObsidianPluginConfigOptions,
): UserConfig => {
  const packageDir = options.packageDir
  const entry = options.entry ?? resolve(packageDir, 'src/main.ts')
  const outDir = resolve(packageDir, options.outDirName ?? 'dist')

  return defineConfig({
    plugins: [vue(), tailwindcss(), copyPluginManifestPlugin(packageDir, outDir)],
    resolve: {
      alias: [
        ...createFoxycapeCoreAliases(packageDir),
        ...Object.entries(options.aliases ?? {}).map(([find, replacement]) => ({
          find,
          replacement,
        })),
        { find: /^@\//, replacement: `${resolve(packageDir, 'src').replace(/\\/g, '/')}/` },
      ],
    },
    build: {
      lib: {
        entry,
        formats: ['cjs'],
        fileName: () => 'main.js',
      },
      rollupOptions: {
        // path2d/canvas are optional Node deps of vendored pdfjs; browser builds must not resolve them.
        external: [
          'obsidian',
          'electron',
          '@codemirror/state',
          '@codemirror/view',
          'path2d',
          'canvas',
        ],
        output: {
          assetFileNames: 'styles.css',
          exports: 'default',
          inlineDynamicImports: true,
        },
      },
      outDir,
      // Keep false so Hot Reload never sees a missing main.js mid-rebuild.
      emptyOutDir: false,
      sourcemap: false,
      target: 'es2020',
      cssCodeSplit: false,
    },
    worker: {
      format: 'es',
    },
    assetsInclude: ['**/*.wasm'],
    optimizeDeps: {
      exclude: ['pdfjs'],
    },
    server: {
      fs: {
        allow: [packageDir],
      },
    },
  })
}
