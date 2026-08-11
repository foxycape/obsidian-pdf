<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import type { Reader } from '@foxycape/core/kernal'
import { isObsidianMobile } from '@/ui/isObsidianMobile'
import PdfTocTree from './PdfTocTree.vue'
import PdfThumbnailPanel from './PdfThumbnailPanel.vue'

const props = defineProps<{
  reader: Reader
  t: (key: string, fallback: string) => string
  open: boolean
  onRequestClose?: () => void
}>()

const onAfterNavigate = () => {
  if (isObsidianMobile()) {
    props.onRequestClose?.()
  }
}

const onThumbnailClick = (event: MouseEvent) => {
  if (!isObsidianMobile()) {
    return
  }
  const target = event.target as Element | null
  if (!target?.closest?.('.thumbnail, a')) {
    return
  }
  props.onRequestClose?.()
}

const DEFAULT_WIDTH = 260
const MIN_WIDTH = 180
const MAX_WIDTH = 480

const rootEl = ref<HTMLElement | null>(null)
const currentTab = ref(0)
const panelWidth = ref(DEFAULT_WIDTH)
const isResizing = ref(false)

let startX = 0
let startWidth = DEFAULT_WIDTH
let resizeSign = 1

const onResizeMove = (e: MouseEvent) => {
  if (!isResizing.value) {
    return
  }
  // Nav sits at inline-start; grow toward inline-end (invert delta in RTL).
  const delta = (e.clientX - startX) * resizeSign
  const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta))
  panelWidth.value = next
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
    class="foxycape-pdf-left-nav"
    :style="{ width: `${panelWidth}px` }"
  >
    <div class="nav-header foxycape-pdf-left-nav__header">
      <div class="foxycape-pdf-left-nav__tabs">
        <button
          type="button"
          class="clickable-icon foxycape-pdf-left-nav__tab"
          :class="{ active: currentTab === 0 }"
          @click="currentTab = 0"
        >
          {{ t('pdf_chrome_toc', 'Contents') }}
        </button>
        <button
          type="button"
          class="clickable-icon foxycape-pdf-left-nav__tab"
          :class="{ active: currentTab === 1 }"
          @click="currentTab = 1"
        >
          {{ t('pdf_chrome_thumbnails', 'Thumbnails') }}
        </button>
      </div>
    </div>
    <div class="foxycape-pdf-left-nav__body">
      <div v-show="currentTab === 0" class="foxycape-pdf-left-nav__panel">
        <PdfTocTree :reader="reader" :t="t" :on-after-navigate="onAfterNavigate" />
      </div>
      <div
        v-show="currentTab === 1"
        class="foxycape-pdf-left-nav__panel"
        @click="onThumbnailClick"
      >
        <PdfThumbnailPanel :reader="reader" :active="open && currentTab === 1" />
      </div>
    </div>
    <div
      class="foxycape-pdf-left-nav__resizer"
      :class="{ 'is-active': isResizing }"
      title="Drag to resize"
      @mousedown="startResize"
    />
  </aside>
</template>

<style scoped>
.foxycape-pdf-left-nav {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 180px;
  max-width: 480px;
  background: var(--background-secondary);
  overflow: hidden;
  flex: 0 0 auto;
}

.foxycape-pdf-left-nav__header {
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--background-modifier-border);
  padding-inline: 8px;
  flex: 0 0 auto;
}

.foxycape-pdf-left-nav__tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 100%;
}

.foxycape-pdf-left-nav__tab {
  color: var(--text-muted);
  font-size: var(--font-ui-small);
}

.foxycape-pdf-left-nav__tab.active {
  color: var(--text-accent);
  font-weight: 600;
}

.foxycape-pdf-left-nav__body {
  flex: 1 1 auto;
  min-height: 0;
  position: relative;
  overflow: hidden;
}

.foxycape-pdf-left-nav__panel {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.foxycape-pdf-left-nav__resizer {
  position: absolute;
  top: 0;
  inset-inline-end: -3px;
  width: 6px;
  height: 100%;
  cursor: col-resize;
  z-index: 5;
  background-color: transparent;
  border-inline-start: 1px solid var(--divider-color);
  box-sizing: border-box;
  /* Leave: hide immediately so quick passes do not flash. */
  transition:
    background-color 0s linear,
    border-color 0s linear;
  transition-delay: 0s;
}

.foxycape-pdf-left-nav__resizer:hover {
  background-color: var(--divider-color-hover);
  border-color: var(--divider-color-hover);
  /* Enter: delay highlight until the pointer settles. */
  transition-delay: 0.3s;
}

.foxycape-pdf-left-nav__resizer.is-active {
  background-color: var(--divider-color-hover);
  border-color: var(--divider-color-hover);
  transition-delay: 0s;
}
</style>
