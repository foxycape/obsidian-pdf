import type { Plugin } from 'obsidian'
import { MARKDOWN_LIB_FILE } from '@/assets/constants'
import { joinPluginPath } from '@/assets/runtimeAssetZip'
import { readMarkdownRuntime } from '@/ai/ui/markdownRuntime'
import { evaluateObsidianCjs } from '@/views/evaluateObsidianCjs'

let evaluated = false

/** Allow a newly downloaded file to replace a runtime already executed in this session. */
export const invalidateMarkdownLibEval = (): void => {
  evaluated = false
}

/**
 * Execute the on-disk markdown runtime. Syntax highlighting and math stay
 * unavailable when this file is missing; callers must not block PDF opening.
 */
export const evaluateMarkdownLib = async (plugin: Plugin): Promise<void> => {
  if (evaluated && readMarkdownRuntime()) {
    return
  }
  const pluginDir = plugin.manifest.dir
  if (!pluginDir) {
    throw new Error('Plugin directory is unavailable (manifest.dir is empty).')
  }
  const source = await plugin.app.vault.adapter.read(joinPluginPath(pluginDir, MARKDOWN_LIB_FILE))
  evaluateObsidianCjs(source, 'markdown-lib.js')
  if (!readMarkdownRuntime()?.createRehypePlugins) {
    throw new Error('markdown-lib.js did not install the markdown runtime.')
  }
  evaluated = true
}
