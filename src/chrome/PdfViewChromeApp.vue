<script setup lang="ts">
import { ref } from 'vue'
import type { Reader } from '@foxycape/core/kernal'
import type {
  PdfViewPreferencePatch,
  PdfViewPreferences,
} from '@/reader/mediaTypes/pdf/CustomPdfOptions'
import { useApplyIcon } from '@/ui/applyIcon'
import ClickableIconButton from '@/ui/ClickableIconButton.vue'
import PdfPagePicker from './PdfPagePicker.vue'
import PdfZoomControls from './PdfZoomControls.vue'
import PdfSettingsPanel from './PdfSettingsPanel.vue'

const props = defineProps<{
  reader: Reader
  t: (key: string, fallback: string, vars?: Record<string, string | number>) => string
  sidebarOpen: boolean
  settingsOpenNonce: number
  onToggleSidebar: () => void
  onOpenMoreMenu?: (event: MouseEvent) => void
  getViewPreferences: () => PdfViewPreferences
  onUpdateViewPreferences: (patch: PdfViewPreferencePatch) => Promise<void>
  navTarget: HTMLElement
  pageTarget: HTMLElement
  zoomTarget: HTMLElement
  settingsTarget: HTMLElement
  moreTarget?: HTMLElement | null
}>()

const navIconEl = ref<HTMLElement | null>(null)
useApplyIcon(navIconEl, () => 'lucide-panel-left')

const onMoreClick = (event: MouseEvent) => {
  props.onOpenMoreMenu?.(event)
}
</script>

<template>
  <Teleport :to="navTarget">
    <button
      type="button"
      class="clickable-icon view-action foxycape-pdf-nav-btn"
      :class="{ 'is-active': sidebarOpen }"
      :aria-label="t('pdf_chrome_nav', 'Navigation')"
      :title="t('pdf_chrome_nav', 'Navigation')"
      :aria-pressed="sidebarOpen"
      @click="onToggleSidebar"
    >
      <span ref="navIconEl" class="foxycape-pdf-nav-btn__icon" aria-hidden="true" />
      <span class="foxycape-pdf-nav-btn__text">{{ t('pdf_chrome_nav', 'Navigation') }}</span>
    </button>
  </Teleport>
  <Teleport :to="pageTarget">
    <PdfPagePicker :reader="reader" :t="t" />
  </Teleport>
  <Teleport :to="zoomTarget">
    <PdfZoomControls :reader="reader" :t="t" />
  </Teleport>
  <Teleport :to="settingsTarget">
    <PdfSettingsPanel
      :reader="reader"
      :t="t"
      :open-nonce="settingsOpenNonce"
      :get-view-preferences="getViewPreferences"
      :on-update-view-preferences="onUpdateViewPreferences"
    />
  </Teleport>
  <Teleport v-if="moreTarget" :to="moreTarget">
    <ClickableIconButton
      icon="lucide-ellipsis-vertical"
      class-name="view-action foxycape-pdf-more-btn"
      :label="t('pdf_chrome_more', 'More options')"
      @click="onMoreClick"
    />
  </Teleport>
</template>
