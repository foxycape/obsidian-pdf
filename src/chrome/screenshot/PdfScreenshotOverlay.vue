<script setup lang="ts">
import { computed } from 'vue'
import type { Reader } from '@foxycape/core/kernal'
import type { PdfImageLinkSource } from '@/obsidian/pdfImageRef'
import type { IApiClient } from '@/network'
import ClickableIconButton from '@/ui/ClickableIconButton.vue'
import { HANDLE_CURSOR, type ScreenshotHandle } from '@/screenshot/screenshotGeometry'
import PdfOcrResultSheet from './PdfOcrResultSheet.vue'
import { usePdfScreenshot } from './usePdfScreenshot'

const props = defineProps<{
  reader: Reader
  hostEl: HTMLElement
  apiClient: IApiClient
  t: (key: string, fallback: string, named?: object) => string
  getLinkSource?: () => PdfImageLinkSource | null
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
  recognizeRegion,
  copyOcrResult,
  reviewOcrResult,
  dismissOcrResult,
} = usePdfScreenshot({
  reader: props.reader,
  hostEl: props.hostEl,
  apiClient: props.apiClient,
  t: props.t,
  getLinkSource: props.getLinkSource,
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
    <div
      ref="overlayEl"
      class="foxycape-pdf-crop-layer"
      :class="{ 'is-comparing': state.ocrResult }"
    >
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
          :icon="state.recognizing === 'text' ? 'loader-2' : 'type'"
          :class-name="{
            'foxycape-pdf-screenshot-menu__btn': true,
            'is-spinning': state.recognizing === 'text',
          }"
          :label="t('pdf_ocr_recognize_text', 'Recognize text')"
          :disabled="state.busy"
          @click.stop="recognizeRegion('text')"
        />
        <ClickableIconButton
          :icon="state.recognizing === 'equation' ? 'loader-2' : 'sigma'"
          :class-name="{
            'foxycape-pdf-screenshot-menu__btn': true,
            'is-spinning': state.recognizing === 'equation',
          }"
          :label="t('pdf_ocr_recognize_equation', 'Recognize equation')"
          :disabled="state.busy"
          @click.stop="recognizeRegion('equation')"
        />
        <ClickableIconButton
          :icon="state.recognizing === 'table' ? 'loader-2' : 'table'"
          :class-name="{
            'foxycape-pdf-screenshot-menu__btn': true,
            'is-spinning': state.recognizing === 'table',
          }"
          :label="t('pdf_ocr_recognize_table', 'Recognize table')"
          :disabled="state.busy"
          @click.stop="recognizeRegion('table', 'ocr-complex-table')"
        />
        <span class="foxycape-pdf-screenshot-menu__divider" />
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
          :disabled="state.busy"
          @click.stop="close"
        />
      </div>
    </div>
  </Teleport>
  <Teleport v-if="state.ocrResult" :to="hostEl">
    <PdfOcrResultSheet
      :result="state.ocrResult"
      :frame="state.sheetFrame"
      :busy="state.reviewing"
      :t="t"
      @copy="copyOcrResult"
      @review="reviewOcrResult"
      @close="dismissOcrResult"
    />
  </Teleport>
</template>
