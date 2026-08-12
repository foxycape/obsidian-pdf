<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import type { IMarker, Reader } from '@foxycape/core/kernal'
import PdfMarkList from './mark-list/PdfMarkList.vue'

const props = defineProps<{
  reader: Reader
  getMarker: () => IMarker | undefined
  open: boolean
  t: (key: string, fallback: string, vars?: Record<string, string | number>) => string
  onClose: () => void
}>()

const DEFAULT_WIDTH = 280
const MIN_WIDTH = 180
const MAX_WIDTH = 480

const rootEl = ref<HTMLElement | null>(null)
const panelWidth = ref(DEFAULT_WIDTH)
const isResizing = ref(false)

let startX = 0
let startWidth = DEFAULT_WIDTH
let resizeSign = 1

const onResizeMove = (e: MouseEvent) => {
  if (!isResizing.value) {
    return
  }
  // Mark panel sits at inline-end; grow toward inline-start (invert delta in RTL).
  const delta = (startX - e.clientX) * resizeSign
  panelWidth.value = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta))
}

const stopResize = () => {
  if (!isResizing.value) {
    return
  }
  isResizing.value = false
  document.body.classList.remove('foxycape-pdf-resizing')
  window.removeEventListener('mousemove', onResizeMove)
  window.removeEventListener('mouseup', stopResize)
}

const startResize = (e: MouseEvent) => {
  e.preventDefault()
  isResizing.value = true
  startX = e.clientX
  startWidth = panelWidth.value
  const el = rootEl.value
  resizeSign =
    el && getComputedStyle(el).direction === 'rtl' ? -1 : 1
  document.body.classList.add('foxycape-pdf-resizing')
  window.addEventListener('mousemove', onResizeMove)
  window.addEventListener('mouseup', stopResize)
}

watch(
  () => props.open,
  (open) => {
    if (!open) {
      stopResize()
    }
  },
)

onBeforeUnmount(() => {
  stopResize()
})
</script>

<template>
  <aside
    ref="rootEl"
    v-show="open"
    class="foxycape-pdf-mark-panel"
    :style="{ '--foxycape-pdf-panel-width': `${panelWidth}px` }"
  >
    <div
      class="foxycape-pdf-mark-panel__resizer"
      :class="{ 'is-active': isResizing }"
      title="Drag to resize"
      @mousedown="startResize"
    />
    <div class="foxycape-pdf-mark-panel__body">
      <PdfMarkList
        :reader="reader"
        :get-marker="getMarker"
        :active="open"
        :t="t"
        :on-close="onClose"
      />
    </div>
  </aside>
</template>

<style scoped>
.foxycape-pdf-mark-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  width: var(--foxycape-pdf-panel-width);
  min-width: 180px;
  max-width: 480px;
  background: var(--background-secondary);
  overflow: hidden;
  flex: 0 0 auto;
}

.foxycape-pdf-mark-panel__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.foxycape-pdf-mark-panel__resizer {
  position: absolute;
  top: 0;
  inset-inline-start: -3px;
  width: 6px;
  height: 100%;
  cursor: col-resize;
  z-index: 5;
  background-color: transparent;
  border-inline-end: 1px solid var(--divider-color);
  box-sizing: border-box;
  transition:
    background-color 0s linear,
    border-color 0s linear;
  transition-delay: 0s;
}

.foxycape-pdf-mark-panel__resizer:hover {
  background-color: var(--divider-color-hover);
  border-color: var(--divider-color-hover);
  transition-delay: 0.3s;
}

.foxycape-pdf-mark-panel__resizer.is-active {
  background-color: var(--divider-color-hover);
  border-color: var(--divider-color-hover);
  transition-delay: 0s;
}
</style>
