export const MARKDOWN_READY_EVENT = 'foxycape-markdown-ready'

export type MarkdownRuntime = {
  createRehypePlugins: () => unknown[]
}

type MarkdownGlobal = typeof globalThis & {
  __foxycapeMarkdownRuntime?: MarkdownRuntime
}

export const readMarkdownRuntime = (): MarkdownRuntime | null =>
  (globalThis as MarkdownGlobal).__foxycapeMarkdownRuntime ?? null
