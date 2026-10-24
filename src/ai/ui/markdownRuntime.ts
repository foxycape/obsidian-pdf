export const MARKDOWN_READY_EVENT = 'foxycape-markdown-ready'

export type MarkdownRuntime = {
  createRehypePlugins: () => unknown[]
}

type MarkdownGlobal = Window & {
  __foxycapeMarkdownRuntime?: MarkdownRuntime
}

export const readMarkdownRuntime = (): MarkdownRuntime | null =>
  (window as MarkdownGlobal).__foxycapeMarkdownRuntime ?? null
