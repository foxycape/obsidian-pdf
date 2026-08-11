<script setup lang="ts">
import type { IMarker, MarkStyleName, Reader } from '@foxycape/core/kernal'
import { computed, onMounted, shallowRef } from 'vue'
import ObsidianIcon from '@/ui/ObsidianIcon.vue'
import { injectToolbarIcons } from './injectToolbarIcons'
import {
  getDisplayMarkColor,
  isSameMarkColor,
  normalizeMarkColor,
} from './markToolbarColors'
import {
  usePdfMarkToolbar,
  type PdfMarkToolbarLinkSource,
} from './usePdfMarkToolbar'

const props = defineProps<{
  reader: Reader
  getMarker: () => IMarker | undefined
  hostEl: HTMLElement
  t: (key: string, fallback: string) => string
  getLinkSource?: () => PdfMarkToolbarLinkSource | null
  ensureEntitled?: () => boolean
}>()

const hostElRef = shallowRef<HTMLElement | null>(props.hostEl)

onMounted(() => {
  injectToolbarIcons(props.hostEl.ownerDocument)
})

const {
  state,
  toolbarEl,
  drawline,
  removeMark,
  setColor,
  pickMoreColor,
  toggleColorPalette,
  onToolbarPointerDown,
  allColors,
  labels,
  copyText,
  copyTextReference,
  openCopyMenu,
  closeCopyMenu,
} = usePdfMarkToolbar({
  reader: props.reader,
  getMarker: props.getMarker,
  hostEl: hostElRef,
  t: props.t,
  getLinkSource: props.getLinkSource,
  ensureEntitled: props.ensureEntitled,
})

const toolbarClass = computed(() => [
  'foxycape-pdf-mark-toolbar',
  'popup-toolbar',
])

const onStyleClick = async (styleName: MarkStyleName) => {
  await drawline(styleName)
}

const isColorActive = (color: string) =>
  isSameMarkColor(state.activeColor, color)

/** Match old ContentToolbar: dark check on light colors, light check on dark colors */
const getCheckColor = (color: string) => {
  const hex = normalizeMarkColor(color).replace('#', '')
  if (!/^[0-9a-f]{6}$/.test(hex)) {
    return '#222'
  }
  const r = Number.parseInt(hex.slice(0, 2), 16) / 255
  const g = Number.parseInt(hex.slice(2, 4), 16) / 255
  const b = Number.parseInt(hex.slice(4, 6), 16) / 255
  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  const luminance =
    0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
  return luminance > 0.3 ? '#222' : '#ffe'
}
</script>

<template>
  <div
    v-show="state.visible"
    ref="toolbarEl"
    :class="toolbarClass"
    :style="{ left: `${state.left}px`, top: `${state.top}px` }"
    @pointerdown="onToolbarPointerDown"
  >
    <div class="foxycape-pdf-mark-toolbar__colors">
      <!-- Style default color (original currentDefaultColor) -->
      <button
        type="button"
        class="foxycape-pdf-mark-toolbar__color-dot clickable-icon"
        :style="{
          background: getDisplayMarkColor(state.defaultColor),
          color: getCheckColor(state.defaultColor),
        }"
        :aria-label="labels.defaultColor()"
        @click.stop="setColor(state.defaultColor)"
      >
        <svg
          v-show="isColorActive(state.defaultColor)"
          class="foxycape-pdf-mark-toolbar__icon foxycape-pdf-mark-toolbar__check"
          aria-hidden="true"
        >
          <use href="#icon-check-line" />
        </svg>
      </button>

      <button
        v-for="color in state.colors"
        :key="color"
        type="button"
        class="foxycape-pdf-mark-toolbar__color-dot clickable-icon"
        :style="{
          background: getDisplayMarkColor(color),
          color: getCheckColor(color),
        }"
        :aria-label="color"
        @click.stop="setColor(color)"
      >
        <svg
          v-show="isColorActive(color)"
          class="foxycape-pdf-mark-toolbar__icon foxycape-pdf-mark-toolbar__check"
          aria-hidden="true"
        >
          <use href="#icon-check-line" />
        </svg>
      </button>

      <button
        type="button"
        class="foxycape-pdf-mark-toolbar__more-color clickable-icon"
        :aria-label="labels.moreColors()"
        @click.stop="toggleColorPalette"
      >
        <svg class="foxycape-pdf-mark-toolbar__icon" aria-hidden="true">
          <use href="#icon-more" />
        </svg>
      </button>

      <div
        v-if="state.showColorPalette"
        class="foxycape-pdf-mark-toolbar__palette"
        @pointerdown.stop
        @click.stop
      >
        <div class="foxycape-pdf-mark-toolbar__palette-scroll">
          <button
            v-for="color in allColors"
            :key="color"
            type="button"
            class="foxycape-pdf-mark-toolbar__palette-item clickable-icon"
            :style="{ background: getDisplayMarkColor(color) }"
            :aria-label="color"
            @click.stop="pickMoreColor(color)"
          />
        </div>
      </div>
    </div>

    <div class="foxycape-pdf-mark-toolbar__main">
      <div
        class="foxycape-pdf-mark-toolbar__copy-wrap"
        :class="{ 'is-menu-open': state.showCopyMenu }"
        @mouseleave="closeCopyMenu"
      >
        <button
          type="button"
          class="foxycape-pdf-mark-toolbar__btn foxycape-pdf-mark-toolbar__copy-btn clickable-icon"
          :aria-label="labels.copyDesc()"
          @click.stop="copyText"
        >
          <span class="foxycape-pdf-mark-toolbar__copy-label">{{ labels.copy() }}</span>
        </button>
        <button
          type="button"
          class="foxycape-pdf-mark-toolbar__btn foxycape-pdf-mark-toolbar__copy-chevron clickable-icon"
          :class="{ 'is-open': state.showCopyMenu }"
          :aria-label="labels.copyTextReference()"
          :aria-expanded="state.showCopyMenu"
          aria-haspopup="menu"
          @mouseenter="openCopyMenu"
          @click.stop="openCopyMenu"
        >
          <span class="foxycape-pdf-mark-toolbar__copy-chevron-icon">
            <ObsidianIcon icon="lucide-chevron-down" />
          </span>
        </button>
        <div
          v-if="state.showCopyMenu"
          class="foxycape-pdf-mark-toolbar__copy-menu"
          role="menu"
          @pointerdown.stop
          @click.stop
          @mouseenter="openCopyMenu"
        >
          <div class="foxycape-pdf-mark-toolbar__copy-menu-panel">
            <button
              type="button"
              class="foxycape-pdf-mark-toolbar__menu-item clickable-icon"
              role="menuitem"
              @click.stop="copyTextReference"
            >
              {{ labels.copyTextReference() }}
            </button>
          </div>
        </div>
      </div>

      <div class="foxycape-pdf-mark-toolbar__style-wrap">
        <button
          type="button"
          class="foxycape-pdf-mark-toolbar__btn clickable-icon"
          :aria-label="labels.markPen()"
          @click.stop="onStyleClick('mark_pen')"
        >
          <span class="foxycape-pdf-mark-toolbar__pen-bg">
            <svg class="foxycape-pdf-mark-toolbar__icon" aria-hidden="true">
              <use href="#icon-font_line" />
            </svg>
          </span>
        </button>
        <i
          class="foxycape-pdf-mark-toolbar__style-dot"
          :class="{ 'is-on': state.activeStyle === 'mark_pen' }"
        />
      </div>

      <div class="foxycape-pdf-mark-toolbar__style-wrap">
        <button
          type="button"
          class="foxycape-pdf-mark-toolbar__btn clickable-icon"
          :aria-label="labels.wavy()"
          @click.stop="onStyleClick('wavy_line')"
        >
          <svg class="foxycape-pdf-mark-toolbar__icon" aria-hidden="true">
            <use href="#icon-font-wavy" />
          </svg>
        </button>
        <i
          class="foxycape-pdf-mark-toolbar__style-dot"
          :class="{ 'is-on': state.activeStyle === 'wavy_line' }"
        />
      </div>

      <div class="foxycape-pdf-mark-toolbar__style-wrap">
        <button
          type="button"
          class="foxycape-pdf-mark-toolbar__btn clickable-icon"
          :aria-label="labels.underline()"
          @click.stop="onStyleClick('underline_straight')"
        >
          <svg class="foxycape-pdf-mark-toolbar__icon" aria-hidden="true">
            <use href="#icon-font-color" />
          </svg>
        </button>
        <i
          class="foxycape-pdf-mark-toolbar__style-dot"
          :class="{ 'is-on': state.activeStyle === 'underline_straight' }"
        />
      </div>

      <button
        v-if="state.markId"
        type="button"
        class="foxycape-pdf-mark-toolbar__btn clickable-icon"
        :aria-label="labels.delete()"
        @click.stop="removeMark"
      >
        <svg class="foxycape-pdf-mark-toolbar__icon" aria-hidden="true">
          <use href="#icon-format-clear" />
        </svg>
      </button>
    </div>
  </div>
</template>
