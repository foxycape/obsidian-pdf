<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Reader } from '@core/kernal'
import { EventNames, type PageChangeOptions } from '@core/kernal'
import { getPdfRenderer } from './usePdfRenderer'

const props = defineProps<{
  reader: Reader
  t: (key: string, fallback: string) => string
}>()

const currentPage = ref(1)
const numberOfPages = ref(1)
const open = ref(false)
const panelRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)
const panelStyle = ref<Record<string, string>>({})

const pageNumbers = computed(() =>
  Array.from({ length: Math.max(numberOfPages.value, 0) }, (_, i) => i + 1),
)

const syncFromRenderer = () => {
  const renderer = getPdfRenderer(props.reader)
  if (!renderer) {
    return
  }
  numberOfPages.value = renderer.numberOfPages || 1
  currentPage.value = renderer.currentPage || 1
}

const gotoPage = async (page: number) => {
  const renderer = getPdfRenderer(props.reader)
  if (!renderer?.pagingNavigator) {
    return
  }
  if (page < 1 || page > numberOfPages.value) {
    return
  }
  const doc = renderer.getDocuments()?.[0]
  if (!doc) {
    return
  }
  await renderer.pagingNavigator.gotoPage(doc, page)
  currentPage.value = page
  open.value = false
}

const positionPanel = () => {
  const trigger = triggerRef.value
  if (!trigger) {
    return
  }
  const rect = trigger.getBoundingClientRect()
  const width = 360
  let left = rect.left + rect.width / 2 - width / 2
  left = Math.max(8, Math.min(left, window.innerWidth - width - 8))
  panelStyle.value = {
    position: 'fixed',
    top: `${rect.bottom + 6}px`,
    left: `${left}px`,
    width: `${width}px`,
    zIndex: '1000',
  }
}

const toggleOpen = async () => {
  open.value = !open.value
  if (open.value) {
    await nextTick()
    positionPanel()
    await nextTick()
    const current = panelRef.value?.querySelector('.each-page.is-current') as HTMLElement | null
    current?.scrollIntoView({ block: 'nearest' })
  }
}

const onDocClick = (e: MouseEvent) => {
  if (!open.value) {
    return
  }
  const target = e.target as Node
  if (triggerRef.value?.contains(target) || panelRef.value?.contains(target)) {
    return
  }
  open.value = false
}

const onPageChange = ({ pageNumber }: PageChangeOptions) => {
  if (pageNumber) {
    currentPage.value = pageNumber
  }
  syncFromRenderer()
}

onMounted(() => {
  syncFromRenderer()
  props.reader.events.on(EventNames.PageChange, onPageChange)
  props.reader.events.on(EventNames.PdfPagesInit, syncFromRenderer)
  document.addEventListener('mousedown', onDocClick)
  window.addEventListener('resize', positionPanel)
})

onBeforeUnmount(() => {
  props.reader.events.off(EventNames.PageChange, onPageChange)
  props.reader.events.off(EventNames.PdfPagesInit, syncFromRenderer)
  document.removeEventListener('mousedown', onDocClick)
  window.removeEventListener('resize', positionPanel)
})

watch(open, (value) => {
  if (value) {
    void nextTick().then(positionPanel)
  }
})
</script>

<template>
  <button
    ref="triggerRef"
    type="button"
    class="clickable-icon view-action foxycape-pdf-page-trigger"
    :aria-label="t('pdf_chrome_page_info', 'Current page / total pages')"
    :title="t('pdf_chrome_page_info', 'Current page / total pages')"
    @click="toggleOpen"
  >
    {{ currentPage }}/{{ numberOfPages }}
  </button>
  <Teleport to="body">
    <div v-if="open" ref="panelRef" class="foxycape-pdf-page-panel" :style="panelStyle">
      <div class="page-numbers">
        <button
          v-for="p in pageNumbers"
          :key="p"
          type="button"
          class="each-page"
          :class="{ 'is-current': p === currentPage }"
          @click="gotoPage(p)"
        >
          {{ p }}
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.foxycape-pdf-page-trigger {
  min-width: 4.5rem;
  font-size: var(--font-ui-small);
}

.foxycape-pdf-page-panel {
  box-sizing: border-box;
  max-height: 300px;
  overflow: hidden;
  padding-block: 15px;
  padding-inline: 5px;
  border: 1px solid var(--background-modifier-border);
  border-radius: var(--radius-m, 6px);
  background: var(--background-primary);
  box-shadow: var(--shadow-s);
}

.mod-rtl .foxycape-pdf-page-panel {
  direction: rtl;
}

.page-numbers {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  max-width: 356px;
  max-height: 280px;
  overflow: auto;
}

.page-numbers::after {
  content: '';
  flex: auto;
}

.each-page {
  display: flex;
  justify-content: center;
  min-width: 40px;
  margin: 5px;
  padding-block: 5px;
  padding-inline: 8px;
  border: 1px solid transparent;
  border-radius: 3px;
  background: transparent;
  color: var(--text-normal);
  line-height: 12px;
  cursor: pointer;
}

.each-page:hover {
  background: var(--background-modifier-hover);
}

.each-page.is-current {
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border-color: var(--interactive-accent);
}
</style>
