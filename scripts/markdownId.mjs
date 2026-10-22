import { createHash } from 'node:crypto'

/**
 * Content id for markdown-lib.js. Plugin releases that do not change KaTeX or
 * highlight.js keep the same id, so the installed file is not downloaded again.
 *
 * @param {Buffer | string} source Built markdown-lib.js
 * @returns {string} e.g. `markdown-a1b2c3d4e5f6`
 */
export const buildMarkdownId = (source) => {
  const hash = createHash('sha256').update(source).digest('hex').slice(0, 12)
  return `markdown-${hash}`
}
