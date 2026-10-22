import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import { MARKDOWN_READY_EVENT, type MarkdownRuntime } from '@/ai/ui/markdownRuntime'

const runtime: MarkdownRuntime = {
  createRehypePlugins: () => [
    [rehypeKatex, { displayMode: true }],
    [rehypeHighlight, { detect: true }],
  ],
}

const host = globalThis as typeof globalThis & {
  __foxycapeMarkdownRuntime?: MarkdownRuntime
  dispatchEvent?: (event: Event) => boolean
}
host.__foxycapeMarkdownRuntime = runtime
host.dispatchEvent?.(new CustomEvent(MARKDOWN_READY_EVENT))

export default runtime
