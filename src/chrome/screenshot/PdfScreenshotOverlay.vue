<script setup lang="ts">
import { computed } from 'vue'
import type { Reader } from '@foxycape/core/kernal'
import type { PdfImageLinkSource } from '@/obsidian/pdfImageRef'
import ClickableIconButton from '@/ui/ClickableIconButton.vue'
import { HANDLE_CURSOR, type ScreenshotHandle } from '@/screenshot/screenshotGeometry'
import { usePdfScreenshot } from './usePdfScreenshot'

const props = defineProps<{
  reader: Reader
  hostEl: HTMLElement
  t: (key: string, fallback: string) => string
  getLinkSource?: () => PdfImageLinkSource | null
  ensureEntitled?: () => boolean
  onActiveChange?: (active: boolean) => void
}>()

const {
  state,
  viewerEl,
  overlayEl,
  menuEl,
  handles,
  setActive,
  toggle,
  close,
  copyImage,
  copyImageReference,
} = usePdfScreenshot({
  reader: props.reader,
  hostEl: props.hostEl,
  t: props.t,
  getLinkSource: props.getLinkSource,
  ensureEntitled: props.ensureEntitled,
  onActiveChange: props.onActiveChange,
})

defineExpose({
  setActive,
  toggle,
  isActive: () => state.active,
})

const rectStyle = computed(() => {
  const rect = state.rect
  if (!rect) {
    return {}
  }
  return {
    left: `${rect.x}px`,
    top: `${rect.y}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  }
})

const handleStyle = (handle: ScreenshotHandle) => {
  const pos: Record<ScreenshotHandle, { left: string; top: string }> = {
    nw: { left: '0%', top: '0%' },
    n: { left: '50%', top: '0%' },
    ne: { left: '100%', top: '0%' },
    e: { left: '100%', top: '50%' },
    se: { left: '100%', top: '100%' },
    s: { left: '50%', top: '100%' },
    sw: { left: '0%', top: '100%' },
    w: { left: '0%', top: '50%' },
  }
  return {
    ...pos[handle],
    cursor: HANDLE_CURSOR[handle],
  }
}

const menuStyle = computed(() => ({
  left: `${state.menuLeft}px`,
  top: `${state.menuTop}px`,
}))
</script>

<template>
  <Teleport v-if="state.active && viewerEl" :to="viewerEl">
    <div ref="overlayEl" class="foxycape-pdf-crop-layer">
      <div v-if="state.rect" class="foxycape-pdf-crop-mask">
        <div class="foxycape-pdf-crop-hole" :style="rectStyle" />
      </div>
      <div
        v-if="state.rect"
        class="foxycape-pdf-crop-rect"
        :style="rectStyle"
      >
        <button
          v-for="handle in handles"
          v-show="state.showChrome"
          :key="handle"
          type="button"
          class="foxycape-pdf-crop-handle  clickable-icon"
          :data-screenshot-handle="handle"
          :style="handleStyle(handle)"
          :aria-label="handle"
        />
      </div>
      <div
        v-show="state.showChrome"
        ref="menuEl"
        class="foxycape-pdf-screenshot-menu"
        :style="menuStyle"
        role="toolbar"
      >
        <ClickableIconButton
          icon="copy"
          class-name="foxycape-pdf-screenshot-menu__btn"
          :label="t('pdf_image_menu_copy', 'Copy image')"
          :disabled="state.busy"
          @click.stop="copyImage"
        />
        <ClickableIconButton
          icon="link"
          class-name="foxycape-pdf-screenshot-menu__btn"
          :label="t('pdf_image_menu_copy_reference', 'Copy image reference')"
          :disabled="state.busy"
          @click.stop="copyImageReference"
        />
        <ClickableIconButton
          icon="x"
          class-name="foxycape-pdf-screenshot-menu__btn"
          :label="t('pdf_image_close', 'Close')"
          @click.stop="close"
        />
      </div>
    </div>
  </Teleport>
</template>
