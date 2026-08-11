<script setup lang="ts">
import ClickableIconButton from '@/ui/ClickableIconButton.vue'

export type TocNode = {
  key: string
  label: string
  pageNumber: number
  children: TocNode[]
  expanded: boolean
  navPoint?: unknown
  parent?: TocNode
}

defineProps<{
  node: TocNode
  selectedKey: string
}>()

const emit = defineEmits<{
  select: [node: TocNode]
  toggle: [node: TocNode]
}>()
</script>

<template>
  <li class="foxycape-pdf-toc__item">
    <div class="foxycape-pdf-toc__row">
      <ClickableIconButton v-if="node.children.length"
        :icon="node.expanded ? 'lucide-chevron-down' : 'lucide-chevron-right'" class-name="foxycape-pdf-toc__expander"
        :label="node.expanded ? 'Collapse' : 'Expand'" @click.stop="emit('toggle', node)" />
      <span v-else class="foxycape-pdf-toc__expander-spacer" />
      <button type="button" class="foxycape-pdf-toc__label clickable-icon" :class="{ 'is-selected': selectedKey === node.key }"
        @click="emit('select', node)">
        <span class="foxycape-pdf-toc__title" style="-webkit-box-orient: vertical">{{ node.label }}</span>
        <span v-if="node.pageNumber > 0" class="foxycape-pdf-toc__page">{{ node.pageNumber }}</span>
      </button>
    </div>
    <ul v-if="node.children.length && node.expanded" class="foxycape-pdf-toc__list">
      <PdfTocNode v-for="child in node.children" :key="child.key" :node="child" :selected-key="selectedKey"
        @select="emit('select', $event)" @toggle="emit('toggle', $event)" />
    </ul>
  </li>
</template>

<style scoped>
.foxycape-pdf-toc__list {
  list-style: none;
  margin: 0;
  padding-inline-start: var(--size-4-8);
}

.foxycape-pdf-toc__item {
  margin: 0;
  margin-block: 2px;
}

.foxycape-pdf-toc__row {
  display: flex;
  align-items: center;
  gap: 0px;
  min-height: 28px;
  border-radius: var(--radius-s, 4px);
}

.foxycape-pdf-toc__label.is-selected {
  background-color: var(--text-selection);
}

.foxycape-pdf-toc__row.is-selected .foxycape-pdf-toc__title {
  color: var(--text-accent);
  font-weight: 600;
}

.foxycape-pdf-toc__expander,
.foxycape-pdf-toc__expander-spacer {
  flex: 0 0 auto;
}

.foxycape-pdf-toc__expander-spacer {
  display: inline-block;
  width: 2em;
  height: 2em;
  visibility: hidden;
}

.foxycape-pdf-toc__label {
  box-sizing: border-box;
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  background-color: transparent;
  color: var(--text-normal);
  text-align: start;
  justify-content: flex-start;
  white-space: normal;
  font-size: var(--font-ui-small);
  line-height: 1.35;
  margin: 0;
  cursor: pointer;
  border-radius: 8px;
}

.foxycape-pdf-toc__label:hover {
  background-color: var(--background-modifier-hover);
}

.foxycape-pdf-toc__title {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  white-space: normal;
  word-break: break-word;
  text-align: start;
}

.foxycape-pdf-toc__page {
  flex: 0 0 auto;
  align-self: center;
  color: var(--text-muted);
  font-size: var(--font-ui-smaller);
  font-variant-numeric: tabular-nums;
}
</style>
