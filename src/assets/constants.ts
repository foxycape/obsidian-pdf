import { MARKDOWN_ID } from './markdownPackId'

/** GitHub repo that hosts release attachments (same tag as manifest.version). */
export const RUNTIME_ASSETS_REPO = 'foxycape/obsidian-pdf'

/** Release attachment name produced by `npm run build` (cmaps, standard fonts, wasm, iccs). */
export const RUNTIME_ASSETS_ZIP_NAME = 'pdfjs-assets.zip'

/** Remote cmaps / standard_fonts / worker / pdf-lib id (pdf.js version only). */
export const RUNTIME_CMAPS_ID = __FOXYCAPE_PDFJS_CMAPS_ID__

/** Written after installing the remote cmaps / fonts zip. */
export const RUNTIME_CMAPS_VERSION_MARKER = 'pdfjs/.foxycape-cmaps-version'

/** Approximate size of the remote cmaps + fonts zip. */
export const RUNTIME_ASSETS_SIZE_HINT = '~1.5 MB'

/** PDF.js library and worker. Downloaded when the pdf.js version changes. */
export const PDFJS_PACK_ZIP_NAME = 'pdfjs.zip'

/** English translations. Missing this file means locales.zip must be downloaded again. */
export const LOCALE_EN_RELATIVE = 'locales/en.json'

/** Content hash of the language JSON files. */
export const LOCALES_ID = __FOXYCAPE_LOCALES_ID__

export const LOCALES_ZIP_NAME = 'locales.zip'

export const LOCALES_VERSION_MARKER = 'locales/.foxycape-locales-version'

/** KaTeX and highlight.js. Downloaded in the background when this content id changes. */
export const MARKDOWN_LIB_FILE = 'markdown.js'

export const MARKDOWN_VERSION_MARKER = 'markdown/.foxycape-markdown-version'

export { MARKDOWN_ID }

export const WORKER_RELATIVE = 'pdfjs/pdf.worker.min.mjs'

export const WORKER_VERSION_MARKER = 'pdfjs/.foxycape-worker-version'

/** PDF.js library evaluated before a document is opened. */
export const PDF_LIB_FILE = 'pdf-lib.js'

export const PDF_LIB_VERSION_MARKER = '.foxycape-pdf-lib-version'

/** Reader, Dexie, the hash worker, and KaTeX woff2. Downloaded when the plugin version changes. */
export const READER_PACK_ZIP_NAME = 'reader-bundle.zip'

/** KaTeX woff2 directory extracted from reader-bundle.zip. */
export const KATEX_FONTS_DIR = 'katex/fonts'

export const READER_BUNDLE_FILE = 'reader-bundle.js'

export const READER_VERSION_MARKER = '.foxycape-reader-version'

/** Paths that must exist after the remote cmaps/fonts/wasm/iccs install. */
export const REMOTE_RUNTIME_MARKERS = [
  'pdfjs/cmaps',
  'pdfjs/standard_fonts',
  'pdfjs/wasm',
  'pdfjs/iccs',
] as const

/** CDN mirror. Used only after the GitHub download stalls or fails. OSS is not requested by the plugin. */
export const CDN_ASSETS_BASE = 'https://cdn.tiefeiying.com/obsidian-pdf/'

const releaseFileUrl = (pluginVersion: string, fileName: string): string =>
  `https://github.com/${RUNTIME_ASSETS_REPO}/releases/download/${pluginVersion}/${fileName}`

const cdnFileUrl = (pluginVersion: string, fileName: string): string =>
  `${CDN_ASSETS_BASE}${pluginVersion}/${fileName}`

/** Fonts zip. Fetched when the cmaps id mismatches. */
export const buildRuntimeAssetsDownloadUrl = (pluginVersion: string): string =>
  releaseFileUrl(pluginVersion, RUNTIME_ASSETS_ZIP_NAME)

export const buildRuntimeAssetsCdnUrl = (pluginVersion: string): string =>
  cdnFileUrl(pluginVersion, RUNTIME_ASSETS_ZIP_NAME)

export const buildPdfjsPackDownloadUrl = (pluginVersion: string): string =>
  releaseFileUrl(pluginVersion, PDFJS_PACK_ZIP_NAME)

export const buildPdfjsPackCdnUrl = (pluginVersion: string): string =>
  cdnFileUrl(pluginVersion, PDFJS_PACK_ZIP_NAME)

export const buildReaderPackDownloadUrl = (pluginVersion: string): string =>
  releaseFileUrl(pluginVersion, READER_PACK_ZIP_NAME)

export const buildReaderPackCdnUrl = (pluginVersion: string): string =>
  cdnFileUrl(pluginVersion, READER_PACK_ZIP_NAME)

export const buildLocalesDownloadUrl = (pluginVersion: string): string =>
  releaseFileUrl(pluginVersion, LOCALES_ZIP_NAME)

export const buildLocalesCdnUrl = (pluginVersion: string): string =>
  cdnFileUrl(pluginVersion, LOCALES_ZIP_NAME)

export const buildMarkdownLibDownloadUrl = (pluginVersion: string): string =>
  releaseFileUrl(pluginVersion, MARKDOWN_LIB_FILE)

export const buildMarkdownLibCdnUrl = (pluginVersion: string): string =>
  cdnFileUrl(pluginVersion, MARKDOWN_LIB_FILE)
