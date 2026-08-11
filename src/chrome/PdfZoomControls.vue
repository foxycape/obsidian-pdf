<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Reader } from '@core/kernal'
import { EventNames } from '@core/kernal'
import ClickableIconButton from '@/ui/ClickableIconButton.vue'
import ObsidianIcon from '@/ui/ObsidianIcon.vue'
import { getPdfRenderer } from './usePdfRenderer'
import type { PdfScaleOption } from './pdfViewTypes'

const props = defineProps<{
  reader: Reader
  t: (key: string, fallback: string) => string
}>()

const currentScaleValue = ref('auto')
const currentScaleLabel = ref('')
const open = ref(false)
const panelRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)
const panelStyle = ref<Record<string, string>>({})

const scaleOptions = computed<PdfScaleOption[]>(() => [
  { label: props.t('pdf_chrome_zoom_auto', 'Auto'), value: 'auto' },
  { label: props.t('pdf_chrome_zoom_page_width', 'Page width'), value: 'page-width' },
  { label: '50%', value: '0.5' },
  { label: '75%', value: '0.75' },
  { label: '100%', value: '1' },
  { label: '150%', value: '1.5' },
  { label: '200%', value: '2' },
  { label: '300%', value: '3' },
])

const menuOptions = computed(() => {
  const options = [...scaleOptions.value]
  const matched = options.some((item) => item.value === currentScaleValue.value)
  if (!matched && currentScaleValue.value) {
    options.push({
      label: currentScaleLabel.value || currentScaleValue.value,
      value: currentScaleValue.value,
    })
  }
  return options
})

const setScaleLabel = (scale: number, scaleValue: string) => {
  const values = [scaleValue]
  if (scaleValue === 'auto' || scaleValue === 'page-fit') {
    values.push('auto', 'page-fit')
  }
  const option = scaleOptions.value.find((item) => values.includes(item.value))
  currentScaleLabel.value = option
    ? option.label
    : `${Math.round(scale * 100)}%`
}

const syncFromRenderer = () => {
  const renderer = getPdfRenderer(props.reader)
  if (!renderer?.scalable) {
    return
  }
  const value = renderer.scalable.currentScaleValue || 'auto'
  currentScaleValue.value = value === 'page-fit' ? 'auto' : value
  setScaleLabel(renderer.scalable.currentScale, currentScaleValue.value)

  const matched = scaleOptions.value.some((item) => item.value === currentScaleValue.value)
  if (!matched && renderer.scalable.currentScale > 0) {
    currentScaleValue.value = String(renderer.scalable.currentScale)
  }
}

const applyScale = async (value: string) => {
  const renderer = getPdfRenderer(props.reader)
  if (!renderer?.scalable) {
    return
  }
  await renderer.scalable.scaleTo(value)
  syncFromRenderer()
  open.value = false
}

const zoomIn = async () => {
  const renderer = getPdfRenderer(props.reader)
  await renderer?.scalable.zoomIn()
  syncFromRenderer()
}

const zoomOut = async () => {
  const renderer = getPdfRenderer(props.reader)
  await renderer?.scalable.zoomOut()
  syncFromRenderer()
}

const onScaleChanging = (scale: number, scaleValue: string) => {
  currentScaleValue.value = scaleValue === 'page-fit' ? 'auto' : scaleValue
  setScaleLabel(scale, currentScaleValue.value)
}

const positionPanel = () => {
  const trigger = triggerRef.value
  if (!trigger) {
    return
  }
  const rect = trigger.getBoundingClientRect()
  const width = Math.max(rect.width, 120)
  let left = rect.left + rect.width / 2 - width / 2
  left = Math.max(8, Math.min(left, window.innerWidth - width - 8))
  panelStyle.value = {
    position: 'fixed',
    top: `${rect.bottom + 6}px`,
    left: `${left}px`,
    minWidth: `${width}px`,
    zIndex: '1000',
  }
}

const toggleOpen = async () => {
  open.value = !open.value
  if (open.value) {
    await nextTick()
    positionPanel()
    await nextTick()
    const current = panelRef.value?.querySelector(
      '.foxycape-pdf-zoom-option.is-current',
    ) as HTMLElement | null
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

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && open.value) {
    open.value = false
  }
}

onMounted(() => {
  syncFromRenderer()
  props.reader.events.on(EventNames.PdfScaleChanging, onScaleChanging)
  props.reader.events.on(EventNames.PdfPagesInit, syncFromRenderer)
  props.reader.events.on(EventNames.LayoutChange, syncFromRenderer)
  document.addEventListener('mousedown', onDocClick)
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', positionPanel)
})

onBeforeUnmount(() => {
  props.reader.events.off(EventNames.PdfScaleChanging, onScaleChanging)
  props.reader.events.off(EventNames.PdfPagesInit, syncFromRenderer)
  props.reader.events.off(EventNames.LayoutChange, syncFromRenderer)
  document.removeEventListener('mousedown', onDocClick)
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', positionPanel)
})

watch(open, (value) => {
  if (value) {
    void nextTick().then(positionPanel)
  }
})
</script>

<template>
  <div class="foxycape-pdf-zoom">
    <button
      ref="triggerRef"
      type="button"
      class="clickable-icon view-action foxycape-pdf-zoom-trigger"
      :class="{ 'is-open': open }"
      :aria-label="t('pdf_chrome_zoom', 'Zoom')"
      :title="currentScaleLabel || t('pdf_chrome_zoom', 'Zoom')"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click="toggleOpen"
    >
      <span class="foxycape-pdf-zoom-trigger__label">
        {{ currentScaleLabel || currentScaleValue }}
      </span>
      <span class="foxycape-pdf-zoom-trigger__chevron">
        <ObsidianIcon icon="lucide-chevron-down" />
      </span>
    </button>
    <Teleport to="body">
      <div
        v-if="open"
        ref="panelRef"
        class="foxycape-pdf-zoom-panel"
        role="listbox"
        :aria-label="t('pdf_chrome_zoom', 'Zoom')"
        :style="panelStyle"
      >
        <button
          v-for="option in menuOptions"
          :key="option.value"
          type="button"
          class="foxycape-pdf-zoom-option clickable-icon"
          role="option"
          :aria-selected="option.value === currentScaleValue"
          :class="{ 'is-current': option.value === currentScaleValue }"
          @click="applyScale(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </Teleport>
    <ClickableIconButton
      icon="lucide-zoom-out"
      class-name="view-action"
      :label="t('pdf_chrome_zoom_out', 'Zoom out')"
      @click="zoomOut"
    />
    <ClickableIconButton
      icon="lucide-zoom-in"
      class-name="view-action"
      :label="t('pdf_chrome_zoom_in', 'Zoom in')"
      @click="zoomIn"
    />
  </div>
</template>

<style scoped>
.foxycape-pdf-zoom {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-inline-end: 4px;
  height: 100%;
}

.foxycape-pdf-zoom-trigger {
  gap: 5px;
  min-width: 3.5rem;
  max-width: 7rem;
  font-size: var(--font-ui-small);
}

.foxycape-pdf-zoom-trigger__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.foxycape-pdf-zoom-trigger__chevron {
  flex-shrink: 0;
  --icon-size: 12px;
  opacity: 0.75;
}

.foxycape-pdf-zoom-panel {
  box-sizing: border-box;
  max-height: 280px;
  overflow: auto;
  padding: 4px;
  border: 1px solid var(--background-modifier-border);
  border-radius: var(--radius-m, 6px);
  background: var(--background-primary);
  box-shadow: var(--shadow-s);
}

.mod-rtl .foxycape-pdf-zoom-panel {
  direction: rtl;
}

.foxycape-pdf-zoom-option {
  display: flex;
  align-items: center;
  width: 100%;
  margin: 0;
  margin-block: 2px;
  padding-block: 6px;
  padding-inline: 10px;
  border-radius: 3px;
  background: transparent;
  color: var(--text-normal);
  font-size: var(--font-ui-small);
  line-height: 1.2;
  text-align: start;
  cursor: pointer;
}

.foxycape-pdf-zoom-option:hover {
  background: var(--background-modifier-hover);
}

.foxycape-pdf-zoom-option.is-current {
  background: var(--interactive-accent);
  color: var(--text-on-accent);
}
</style>
