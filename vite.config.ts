import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createObsidianPluginConfig } from './scripts/vite/createObsidianPluginConfig'
import { resolveFoxycapeCore } from './scripts/resolveFoxycapeCore'
import { buildPdfjsCmapsId, buildRuntimeAssetsId } from './scripts/runtimeAssetsId.mjs'
import { readObsidianPluginDir } from './scripts/readObsidianPluginDir.mjs'
import { assertNoHostPdfjsGlobalsPlugin } from './vite.rename-pdfjs-globals'
import { assertNoDynamicScriptElementsPlugin } from './vite.strip-localforage'
import { copyToVaultPlugin } from './vite.copy-to-vault'
import { copyLocalesPlugin } from './vite.copy-locales'
import { mergePdfBundleCssPlugin } from './vite.merge-pdf-css'

const packageDir = fileURLToPath(new URL('.', import.meta.url))
const { pdfjsDir: corePdfjsDir } = resolveFoxycapeCore(packageDir)
const outDir = resolve(packageDir, 'dist')
const mainJsPath = resolve(outDir, 'main.js')
const signerSrcFile = resolve(packageDir, 'static/signer.js')
const pdfjsCmapsId = buildPdfjsCmapsId(corePdfjsDir)
const runtimeId = buildRuntimeAssetsId(corePdfjsDir, signerSrcFile)
const vaultPluginDir = readObsidianPluginDir(packageDir)

const base = createObsidianPluginConfig({
  packageDir,
  outDirName: 'dist',
})

export default {
  ...base,
  define: {
    ...base.define,
    __FOXYCAPE_PDFJS_CMAPS_ID__: JSON.stringify(pdfjsCmapsId),
    __FOXYCAPE_RUNTIME_ID__: JSON.stringify(runtimeId),
  },
  plugins: [
    ...(base.plugins ?? []),
    assertNoHostPdfjsGlobalsPlugin(mainJsPath),
    assertNoDynamicScriptElementsPlugin(mainJsPath),
    mergePdfBundleCssPlugin(outDir),
    copyLocalesPlugin(packageDir, outDir),
    copyToVaultPlugin(outDir, vaultPluginDir),
  ],
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
      },
    },
  },
}
