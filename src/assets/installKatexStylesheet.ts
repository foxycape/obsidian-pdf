import type { Plugin } from 'obsidian'
import { KATEX_CSS } from './constants'
import { joinPluginPath } from './runtimeAssetZip'

const STYLE_ID = 'foxycape-katex'

/** Read katex.css and inject it as a style tag once the file is in the plugin directory. */
export const installKatexStylesheet = async (plugin: Plugin): Promise<void> => {
  const pluginDir = plugin.manifest.dir
  if (!pluginDir) {
    return
  }
  const cssPath = joinPluginPath(pluginDir, KATEX_CSS)
  const adapter = plugin.app.vault.adapter
  if (!(await adapter.exists(cssPath))) {
    return
  }
  const css = await adapter.read(cssPath)
  let style = document.getElementById(STYLE_ID)
  if (!(style instanceof HTMLStyleElement)) {
    style?.remove()
    const created = document.createElement('style')
    created.id = STYLE_ID
    document.head.appendChild(created)
    style = created
  }
  if (style.textContent === css) {
    return
  }
  style.textContent = css
}

export const removeKatexStylesheet = (): void => {
  document.getElementById(STYLE_ID)?.remove()
}
