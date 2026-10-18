<script setup lang="ts">
import { computed } from 'vue'
import { type CustomAttrs, type PluggableList, VueMarkdown } from '@crazydos/vue-markdown'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import 'katex/dist/katex.min.css'
import { parseCiteHref } from '../chat/citationRefs'
import { prepareMarkdown } from '../chat/renderMarkdown'

const props = defineProps<{
  content?: string
  isReasoning?: boolean
}>()

const emit = defineEmits<{
  cite: [id: string, anchor: HTMLElement]
}>()

const markdown = computed(() =>
  prepareMarkdown(props.content ?? '', { isReasoning: props.isReasoning }),
)

const remarkPlugins: PluggableList = props.isReasoning ? [] : [remarkMath, remarkGfm]
const rehypePlugins: PluggableList = props.isReasoning
  ? []
  : [
      [rehypeKatex, { displayMode: true }],
      [rehypeHighlight, { detect: true }],
    ]

const customAttrs: CustomAttrs = {
  a: (node) => {
    const href = typeof node.properties.href === 'string' ? node.properties.href : ''
    if (parseCiteHref(href)) {
      return { class: ['fpdf-cite'] }
    }
    return { target: '_blank', rel: 'noopener noreferrer' }
  },
}

const onClick = (event: MouseEvent) => {
  const target = event.target
  if (!(target instanceof Element)) {
    return
  }
  const link = target.closest('a')
  if (!(link instanceof HTMLElement)) {
    return
  }
  const id = parseCiteHref(link.getAttribute('href'))
  if (!id) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  emit('cite', id, link)
}
</script>

<template>
  <div class="fpdf-markdown" :class="{ 'is-reasoning': isReasoning }" @click.capture="onClick">
    <VueMarkdown
      :markdown="markdown"
      :remark-plugins="remarkPlugins"
      :rehype-plugins="rehypePlugins"
      :sanitize="false"
      :custom-attrs="customAttrs"
    />
  </div>
</template>
