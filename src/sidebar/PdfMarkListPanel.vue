<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { Reader } from '@foxycape/core/kernal'
import type { IMarker } from '@/mark'
import type { DexieStorage } from '@/storage/DexieStorage'
import ClickableIconButton from '@/ui/ClickableIconButton.vue'
import { isObsidianMobile } from '@/ui/isObsidianMobile'
import PdfMarkList from './mark-list/PdfMarkList.vue'
import PdfPassageList from './mark-list/PdfPassageList.vue'

type MarksTab = 'highlights' | 'translates' | 'explains' | 'lookups'

const props = defineProps<{
  reader: Reader
  storage: DexieStorage
  getMarker: () => IMarker | undefined
  open: boolean
  requestedTab?: MarksTab
  tabNonce?: number
  t: (key: string, fallback: string, vars?: Record<string, string | number>) => string
  onClose: () => void
}>()

const currentTab = ref<MarksTab>('highlights')
const tabs = computed(() => [
  { id: 'highlights' as const, label: props.t('ai_marks_tab_highlights', 'Highlights') },
  { id: 'translates' as const, label: props.t('ai_marks_tab_translate', 'Translate') },
  { id: 'explains' as const, label: props.t('ai_marks_tab_explain', 'Explain') },
  { id: 'lookups' as const, label: props.t('ai_marks_tab_lookup', 'Look up') },
])

const selectTab = (tab: MarksTab) => {
  currentTab.value = tab
}

const onNavigated = () => {
  if (isObsidianMobile()) {
    props.onClose()
  }
}

watch(
  () => [props.requestedTab, props.tabNonce] as const,
  ([tab]) => {
    if (tab) {
      selectTab(tab)
    }
  },
)

const DEFAULT_WIDTH = 300
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
      <header class="foxycape-pdf-mark-panel__header">
        <div class="foxycape-pdf-mark-tabs" role="tablist">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            class="foxycape-pdf-mark-tabs__tab"
            :class="{ 'is-active': currentTab === tab.id }"
            role="tab"
            :aria-selected="currentTab === tab.id"
            @click="selectTab(tab.id)"
          >
            {{ tab.label }}
          </button>
        </div>
        <ClickableIconButton
          icon="x"
          class-name="nav-action-button"
          :label="t('pdf_mark_list_close', 'Close')"
          @click="onClose"
        />
      </header>
      <div class="foxycape-pdf-mark-tabs__page">
        <PdfMarkList
          v-show="currentTab === 'highlights'"
          :reader="reader"
          :get-marker="getMarker"
          :active="open && currentTab === 'highlights'"
          :t="t"
          :on-close="onClose"
        />
        <PdfPassageList
          v-show="currentTab === 'translates'"
          kind="translate"
          :reader="reader"
          :storage="storage"
          :get-marker="getMarker"
          :active="open && currentTab === 'translates'"
          :t="t"
          @navigated="onNavigated"
        />
        <PdfPassageList
          v-show="currentTab === 'explains'"
          kind="explain"
          :reader="reader"
          :storage="storage"
          :get-marker="getMarker"
          :active="open && currentTab === 'explains'"
          :t="t"
          @navigated="onNavigated"
        />
        <PdfPassageList
          v-show="currentTab === 'lookups'"
          kind="lookup"
          :reader="reader"
          :storage="storage"
          :get-marker="getMarker"
          :active="open && currentTab === 'lookups'"
          :t="t"
          @navigated="onNavigated"
        />
      </div>
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
  overflow: visible;
  flex: 0 0 auto;
}

.foxycape-pdf-mark-panel__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.foxycape-pdf-mark-panel__header {
  display: flex;
  align-items: center;
  height: 40px;
  flex: 0 0 auto;
  border-bottom: 1px solid var(--background-modifier-border);
  padding-inline-end: 4px;
}

.foxycape-pdf-mark-panel__header > :last-child {
  flex: 0 0 auto;
}

.foxycape-pdf-mark-tabs {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 4px;
  height: 100%;
  min-width: 0;
  overflow-x: auto;
  padding: 0 8px;
  scrollbar-width: none;
}

.foxycape-pdf-mark-tabs::-webkit-scrollbar {
  display: none;
}

.foxycape-pdf-mark-tabs__tab {
  flex: 0 0 auto;
  height: 28px;
  border: 0;
  border-radius: var(--radius-s);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0 10px;
  white-space: nowrap;
  box-shadow: none;
}

.foxycape-pdf-mark-tabs__tab:hover {
  background: var(--background-modifier-hover);
  color: var(--text-normal);
}

.foxycape-pdf-mark-tabs__tab.is-active {
  background: var(--background-modifier-hover);
  color: var(--text-normal);
}

.foxycape-pdf-mark-tabs__page {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.foxycape-pdf-mark-tabs__page > * {
  flex: 1 1 auto;
  min-height: 0;
}

.foxycape-pdf-mark-panel__resizer {
  position: absolute;
  top: 0;
  inset-inline-start: 0;
  width: 1px;
  height: 100%;
  cursor: col-resize;
  z-index: 6;
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
