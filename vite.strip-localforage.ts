import { readFileSync } from 'node:fs'
import type { Plugin } from 'vite'

const DYNAMIC_SCRIPT_RE = /createElement\(\s*['"`]script['"`]\s*\)/

export const assertNoDynamicScriptElementsPlugin = (mainJsPath: string): Plugin => ({
  name: 'assert-no-dynamic-script-elements',
  writeBundle() {
    const code = readFileSync(mainJsPath, 'utf8')
    const matches = code.match(new RegExp(DYNAMIC_SCRIPT_RE.source, 'g')) ?? []
    if (matches.length > 0) {
      throw new Error(
        `[foxycape-pdf] ${mainJsPath} still contains ${matches.length} dynamic ` +
          '<script> element creation(s). Obsidian review will reject this bundle.',
      )
    }
  },
})
