<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import {
  Astroid,
  Baseline,
  BookA,
  ChevronDown,
  ChevronLeft,
  Copy,
  EllipsisVertical,
  Eraser,
  Highlighter,
  Languages,
  MessageCircleQuestionMark,
  Settings,
  SpellCheck2,
} from '@lucide/vue'
import type { Reader } from '@foxycape/core/kernal'
import type { IHttpClient } from '@foxycape/core/kernal/network/IHttpClient'
import type { IMarker, MarkStyleName } from '@/mark'
import type { DexieStorage } from '@/storage/DexieStorage'
import type { IStorage } from '@/storage/IStorage'
import type { AiAccessMode } from '@/ai/accessChoice'
import { resolveAiAccessChoice } from '@/ai/accessChoice'
import type { PassageRef } from '@/ai/passage/types'
import { useHistoryLayer } from '@/history/useHistoryLayer'
import type { ToolbarVisibility } from '@/settings/types'
import { useDismissOnOutside } from '@/ui/useDismissOnOutside'
import { injectToolbarIcons } from './injectToolbarIcons'
import {
  getDisplayMarkColor,
  isSameMarkColor,
  normalizeMarkColor,
} from './markToolbarColors'
import PdfPassagePanel from './PdfPassagePanel.vue'
import PdfTranslatePanel from './PdfTranslatePanel.vue'
import {
  usePdfMarkToolbar,
  type PdfMarkToolbarLinkSource,
} from './usePdfMarkToolbar'

const props = defineProps<{
  reader: Reader
  getMarker: () => IMarker | undefined
  hostEl: HTMLElement
  t: (key: string, fallback: string, named?: object) => string
  storage: IStorage
  passageStorage: DexieStorage
  httpClient: IHttpClient
  getLinkSource?: () => PdfMarkToolbarLinkSource | null
  onOpenAi?: (draft: {
    simpleId: string
    quote: string
    markId: string
    pageNumber?: number
    prompt?: string
    autoSend?: boolean
    displayInput?: string
  }) => void
  onNeedAccess?: (mode: AiAccessMode) => void
  onOpenModel?: () => void
  onOpenLanguage?: () => void
  onOpenTranslateList?: () => void
  getVisibility: () => ToolbarVisibility
  setVisibility: (next: ToolbarVisibility) => void
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
  onToolbarPointerDown,
  allColors,
  labels,
  copyText,
  copyTextReference,
  openCopyMenu,
  closeCopyMenu,
  resolvePassage,
  hide,
  reposition,
} = usePdfMarkToolbar({
  reader: props.reader,
  getMarker: props.getMarker,
  hostEl: hostElRef,
  t: props.t,
  storage: props.storage,
  getLinkSource: props.getLinkSource,
})

type VisibilityKey = keyof ReturnType<typeof props.getVisibility>
const visibility = reactive(props.getVisibility())
const moreOpen = ref(false)
const moreRoot = ref<HTMLElement | null>(null)

useHistoryLayer(moreOpen, () => {
  moreOpen.value = false
})

watch(
  () => state.visible,
  (visible) => {
    if (!visible) {
      moreOpen.value = false
    }
  },
)

useDismissOnOutside(
  () => moreOpen.value,
  () => [moreRoot.value],
  () => {
    moreOpen.value = false
  },
)

const toggleVisibility = async (key: VisibilityKey) => {
  visibility[key] = !visibility[key]
  props.setVisibility({ ...visibility })
}

const overflowItems = computed(() => {
  const items: { id: VisibilityKey; label: string; run: () => void }[] = []
  if (!visibility.displayMarkPenInToolbar) {
    items.push({ id: 'displayMarkPenInToolbar', label: labels.markPen(), run: () => void onStyleClick('mark_pen') })
  }
  if (!visibility.displayWavyInToolbar) {
    items.push({ id: 'displayWavyInToolbar', label: labels.wavy(), run: () => void onStyleClick('wavy_line') })
  }
  if (!visibility.displayUnderlineInToolbar) {
    items.push({ id: 'displayUnderlineInToolbar', label: labels.underline(), run: () => void onStyleClick('underline_straight') })
  }
  if (!visibility.displayTranslateInToolbar) {
    items.push({ id: 'displayTranslateInToolbar', label: labels.translate(), run: () => void openTranslate() })
  }
  if (!visibility.displayExplainPassageInToolbar) {
    items.push({ id: 'displayExplainPassageInToolbar', label: labels.explain(), run: () => void openExplain() })
  }
  if (!visibility.displayLookupWordInToolbar) {
    items.push({ id: 'displayLookupWordInToolbar', label: labels.lookup(), run: () => void openLookup() })
  }
  if (!visibility.displayAiInToolbar) {
    items.push({ id: 'displayAiInToolbar', label: labels.ai(), run: () => openAi() })
  }
  return items
})

const runOverflow = (run: () => void) => {
  moreOpen.value = false
  run()
}

const openToolbarSettings = () => {
  moreOpen.value = false
  state.panelMode = 'settings'
}

const passage = ref<Pick<PassageRef, 'markId' | 'simpleId' | 'text' | 'pageNumber' | 'navUrl' | 'navTitle' | 'contentRange'> | null>(null)
const hasOpenedTranslate = ref(false)
const hasOpenedExplain = ref(false)
const hasOpenedLookup = ref(false)

const toolbarClass = computed(() => [
  'foxycape-pdf-mark-toolbar',
  'popup-toolbar',
  state.panelMode !== 'toolbar' ? 'is-panel' : '',
  hasOpenedTranslate.value && passage.value ? 'has-translate' : '',
])

const onStyleClick = async (styleName: MarkStyleName) => {
  await drawline(styleName)
}

const afterPanel = async () => {
  await nextTick()
  reposition()
}

const requireAccess = async () => {
  try {
    const mode = await resolveAiAccessChoice()
    if (!mode) {
      return true
    }
    hide(true)
    props.onNeedAccess?.(mode)
    return false
  } catch {
    return true
  }
}

const openTranslate = async () => {
  if (state.panelMode === 'translate') {
    return
  }
  const resolved = await resolvePassage()
  if (!resolved) {
    return
  }
  passage.value = resolved
  hasOpenedTranslate.value = true
  state.panelMode = 'translate'
  await afterPanel()
}

const openExplain = async () => {
  if (state.panelMode === 'explain') {
    return
  }
  if (!(await requireAccess())) {
    return
  }
  const resolved = await resolvePassage()
  if (!resolved) {
    return
  }
  passage.value = resolved
  hasOpenedExplain.value = true
  state.panelMode = 'explain'
  await afterPanel()
}

const openLookup = async () => {
  if (state.panelMode === 'lookup') {
    return
  }
  if (!(await requireAccess())) {
    return
  }
  const resolved = await resolvePassage()
  if (!resolved) {
    return
  }
  passage.value = resolved
  hasOpenedLookup.value = true
  state.panelMode = 'lookup'
  await afterPanel()
}

const openAi = async (prompt?: string, autoSend = false) => {
  const resolved = autoSend && passage.value ? passage.value : await resolvePassage()
  if (!resolved) {
    return
  }
  hide(true)
  props.onOpenAi?.({
    simpleId: resolved.simpleId,
    quote: resolved.text,
    markId: resolved.markId,
    pageNumber: resolved.pageNumber,
    prompt,
    autoSend,
    displayInput: autoSend ? props.t('ai_learn_more', 'Learn more') : undefined,
  })
}

const pickColor = async (color: string) => {
  await pickMoreColor(color)
  state.panelMode = 'toolbar'
  await afterPanel()
}

const openColors = async () => {
  state.panelMode = 'colors'
  await afterPanel()
}

const backToToolbar = async () => {
  state.panelMode = 'toolbar'
  await afterPanel()
}

const onQuota = () => {
  hide(true)
  props.onNeedAccess?.('quota')
}

const isColorActive = (color: string) => isSameMarkColor(state.activeColor, color)

const getCheckColor = (color: string) => {
  const hex = normalizeMarkColor(color).replace('#', '')
  if (!/^[0-9a-f]{6}$/.test(hex)) {
    return '#222'
  }
  const r = Number.parseInt(hex.slice(0, 2), 16) / 255
  const g = Number.parseInt(hex.slice(2, 4), 16) / 255
  const b = Number.parseInt(hex.slice(4, 6), 16) / 255
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
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
    <div v-if="state.panelMode === 'colors'" class="fpdf-drill" @pointerdown.stop>
      <header class="fpdf-center-bar">
        <div>
          <button type="button" class="clickable-icon fpdf-icon-btn" :aria-label="t('ai_back', 'Back')" @click="backToToolbar">
            <ChevronLeft class="fpdf-icon" />
          </button>
        </div>
        <div class="fpdf-center-title">{{ labels.moreColors() }}</div>
        <div />
      </header>
      <div class="foxycape-pdf-mark-toolbar__palette-scroll">
        <button
          v-for="color in allColors"
          :key="color"
          type="button"
          class="foxycape-pdf-mark-toolbar__palette-item clickable-icon"
          :style="{ background: getDisplayMarkColor(color) }"
          :aria-label="color"
          @click.stop="pickColor(color)"
        />
      </div>
    </div>

    <div v-if="state.panelMode === 'settings'" class="fpdf-drill" @pointerdown.stop>
      <header class="fpdf-center-bar">
        <div>
          <button type="button" class="clickable-icon fpdf-icon-btn" :aria-label="t('ai_back', 'Back')" @click="backToToolbar">
            <ChevronLeft class="fpdf-icon" />
          </button>
        </div>
        <div class="fpdf-center-title">{{ t('ai_toolbar_options', 'Menu options') }}</div>
        <div />
      </header>
      <p class="foxycape-pdf-toolbar-settings__tip">
        {{ t('ai_toolbar_options_tip', 'Choose which buttons appear on the toolbar') }}
      </p>
      <div class="foxycape-pdf-toolbar-settings">
        <div class="foxycape-pdf-toolbar-settings__row">
          <span>{{ labels.markPen() }}</span>
          <div class="checkbox-container" :class="{ 'is-enabled': visibility.displayMarkPenInToolbar }" role="switch" :aria-checked="visibility.displayMarkPenInToolbar" tabindex="0" @click="toggleVisibility('displayMarkPenInToolbar')" />
        </div>
        <div class="foxycape-pdf-toolbar-settings__row">
          <span>{{ labels.wavy() }}</span>
          <div class="checkbox-container" :class="{ 'is-enabled': visibility.displayWavyInToolbar }" role="switch" :aria-checked="visibility.displayWavyInToolbar" tabindex="0" @click="toggleVisibility('displayWavyInToolbar')" />
        </div>
        <div class="foxycape-pdf-toolbar-settings__row">
          <span>{{ labels.underline() }}</span>
          <div class="checkbox-container" :class="{ 'is-enabled': visibility.displayUnderlineInToolbar }" role="switch" :aria-checked="visibility.displayUnderlineInToolbar" tabindex="0" @click="toggleVisibility('displayUnderlineInToolbar')" />
        </div>
        <div class="foxycape-pdf-toolbar-settings__row">
          <span>{{ labels.translate() }}</span>
          <div class="checkbox-container" :class="{ 'is-enabled': visibility.displayTranslateInToolbar }" role="switch" :aria-checked="visibility.displayTranslateInToolbar" tabindex="0" @click="toggleVisibility('displayTranslateInToolbar')" />
        </div>
        <div class="foxycape-pdf-toolbar-settings__row">
          <span>{{ labels.explain() }}</span>
          <div class="checkbox-container" :class="{ 'is-enabled': visibility.displayExplainPassageInToolbar }" role="switch" :aria-checked="visibility.displayExplainPassageInToolbar" tabindex="0" @click="toggleVisibility('displayExplainPassageInToolbar')" />
        </div>
        <div class="foxycape-pdf-toolbar-settings__row">
          <span>{{ labels.lookup() }}</span>
          <div class="checkbox-container" :class="{ 'is-enabled': visibility.displayLookupWordInToolbar }" role="switch" :aria-checked="visibility.displayLookupWordInToolbar" tabindex="0" @click="toggleVisibility('displayLookupWordInToolbar')" />
        </div>
        <div class="foxycape-pdf-toolbar-settings__row">
          <span>{{ labels.ai() }}</span>
          <div class="checkbox-container" :class="{ 'is-enabled': visibility.displayAiInToolbar }" role="switch" :aria-checked="visibility.displayAiInToolbar" tabindex="0" @click="toggleVisibility('displayAiInToolbar')" />
        </div>
      </div>
    </div>

    <PdfTranslatePanel
      v-if="hasOpenedTranslate && passage"
      v-show="state.panelMode === 'translate'"
      :source-text="passage.text"
      :mark-id="passage.markId"
      :simple-id="passage.simpleId"
      :page-number="passage.pageNumber"
      :nav-url="passage.navUrl"
      :nav-title="passage.navTitle"
      :content-range="passage.contentRange"
      :storage="passageStorage"
      :http-client="httpClient"
      :t="t"
      @back="backToToolbar"
      @open-model="onOpenModel?.()"
      @need-access="(mode) => { hide(true); onNeedAccess?.(mode) }"
      @open-list="onOpenTranslateList?.()"
      @quota="onQuota"
    />

    <PdfPassagePanel
      v-if="hasOpenedExplain && passage"
      v-show="state.panelMode === 'explain'"
      kind="explain"
      :source-text="passage.text"
      :mark-id="passage.markId"
      :simple-id="passage.simpleId"
      :page-number="passage.pageNumber"
      :nav-url="passage.navUrl"
      :nav-title="passage.navTitle"
      :content-range="passage.contentRange"
      :storage="passageStorage"
      :active="state.panelMode === 'explain'"
      :t="t"
      @back="backToToolbar"
      @deeper="(prompt) => openAi(prompt, true)"
      @open-model="onOpenModel?.()"
      @open-language="onOpenLanguage?.()"
      @quota="onQuota"
    />

    <PdfPassagePanel
      v-if="hasOpenedLookup && passage"
      v-show="state.panelMode === 'lookup'"
      kind="lookup"
      :source-text="passage.text"
      :mark-id="passage.markId"
      :simple-id="passage.simpleId"
      :page-number="passage.pageNumber"
      :nav-url="passage.navUrl"
      :nav-title="passage.navTitle"
      :content-range="passage.contentRange"
      :storage="passageStorage"
      :active="state.panelMode === 'lookup'"
      :t="t"
      @back="backToToolbar"
      @deeper="(prompt) => openAi(prompt, true)"
      @open-model="onOpenModel?.()"
      @open-language="onOpenLanguage?.()"
      @quota="onQuota"
    />

    <template v-if="state.panelMode === 'toolbar'">
      <div class="foxycape-pdf-mark-toolbar__colors">
        <button
          type="button"
          class="foxycape-pdf-mark-toolbar__color-dot clickable-icon"
          :style="{ background: getDisplayMarkColor(state.defaultColor), color: getCheckColor(state.defaultColor) }"
          :aria-label="labels.defaultColor()"
          @click.stop="setColor(state.defaultColor)"
        >
          <svg v-show="isColorActive(state.defaultColor)" class="foxycape-pdf-mark-toolbar__icon foxycape-pdf-mark-toolbar__check" aria-hidden="true">
            <use href="#icon-check-line" />
          </svg>
        </button>
        <button
          v-for="color in state.colors"
          :key="color"
          type="button"
          class="foxycape-pdf-mark-toolbar__color-dot clickable-icon"
          :style="{ background: getDisplayMarkColor(color), color: getCheckColor(color) }"
          :aria-label="color"
          @click.stop="setColor(color)"
        >
          <svg v-show="isColorActive(color)" class="foxycape-pdf-mark-toolbar__icon foxycape-pdf-mark-toolbar__check" aria-hidden="true">
            <use href="#icon-check-line" />
          </svg>
        </button>
        <button type="button" class="foxycape-pdf-mark-toolbar__more-color clickable-icon" :aria-label="labels.moreColors()" @click.stop="openColors">
          <svg class="foxycape-pdf-mark-toolbar__icon" aria-hidden="true">
            <use href="#icon-more" />
          </svg>
        </button>
      </div>

      <div class="foxycape-pdf-mark-toolbar__main">
        <div class="foxycape-pdf-mark-toolbar__copy-wrap" :class="{ 'is-menu-open': state.showCopyMenu }" @mouseleave="closeCopyMenu">
          <button type="button" class="foxycape-pdf-mark-toolbar__btn clickable-icon" :aria-label="labels.copyDesc()" @click.stop="copyText">
            <Copy class="fpdf-icon" />
          </button>
          <button
            type="button"
            class="foxycape-pdf-mark-toolbar__btn foxycape-pdf-mark-toolbar__copy-chevron clickable-icon"
            :class="{ 'is-open': state.showCopyMenu }"
            :aria-label="labels.copyTextReference()"
            @mouseenter="openCopyMenu"
            @click.stop="openCopyMenu"
          >
            <ChevronDown class="fpdf-icon fpdf-icon--sm" />
          </button>
          <div v-if="state.showCopyMenu" class="foxycape-pdf-mark-toolbar__copy-menu" role="menu" @pointerdown.stop @click.stop>
            <div class="foxycape-pdf-mark-toolbar__copy-menu-panel">
              <button type="button" class="foxycape-pdf-mark-toolbar__menu-item clickable-icon" role="menuitem" @click.stop="copyTextReference">
                {{ labels.copyTextReference() }}
              </button>
            </div>
          </div>
        </div>

        <div v-if="visibility.displayMarkPenInToolbar" class="foxycape-pdf-mark-toolbar__style-wrap">
          <button type="button" class="foxycape-pdf-mark-toolbar__btn clickable-icon" :aria-label="labels.markPen()" @click.stop="onStyleClick('mark_pen')">
            <Highlighter class="fpdf-icon" />
          </button>
          <i class="foxycape-pdf-mark-toolbar__style-dot" :class="{ 'is-on': state.activeStyle === 'mark_pen' }" />
        </div>
        <div v-if="visibility.displayWavyInToolbar" class="foxycape-pdf-mark-toolbar__style-wrap">
          <button type="button" class="foxycape-pdf-mark-toolbar__btn clickable-icon" :aria-label="labels.wavy()" @click.stop="onStyleClick('wavy_line')">
            <SpellCheck2 class="fpdf-icon" />
          </button>
          <i class="foxycape-pdf-mark-toolbar__style-dot" :class="{ 'is-on': state.activeStyle === 'wavy_line' }" />
        </div>
        <div v-if="visibility.displayUnderlineInToolbar" class="foxycape-pdf-mark-toolbar__style-wrap">
          <button type="button" class="foxycape-pdf-mark-toolbar__btn clickable-icon" :aria-label="labels.underline()" @click.stop="onStyleClick('underline_straight')">
            <Baseline class="fpdf-icon" />
          </button>
          <i class="foxycape-pdf-mark-toolbar__style-dot" :class="{ 'is-on': state.activeStyle === 'underline_straight' }" />
        </div>
        <button v-if="state.markId" type="button" class="foxycape-pdf-mark-toolbar__btn clickable-icon" :aria-label="labels.delete()" @click.stop="removeMark">
          <Eraser class="fpdf-icon" />
        </button>
        <button v-if="visibility.displayTranslateInToolbar" type="button" class="foxycape-pdf-mark-toolbar__btn clickable-icon" :aria-label="labels.translate()" @click.stop="openTranslate">
          <Languages class="fpdf-icon" />
        </button>
        <button v-if="visibility.displayExplainPassageInToolbar" type="button" class="foxycape-pdf-mark-toolbar__btn clickable-icon" :aria-label="labels.explain()" @click.stop="openExplain">
          <MessageCircleQuestionMark class="fpdf-icon" />
        </button>
        <button v-if="visibility.displayLookupWordInToolbar" type="button" class="foxycape-pdf-mark-toolbar__btn clickable-icon" :aria-label="labels.lookup()" @click.stop="openLookup">
          <BookA class="fpdf-icon" />
        </button>
        <button v-if="visibility.displayAiInToolbar" type="button" class="foxycape-pdf-mark-toolbar__btn clickable-icon" :aria-label="labels.ai()" @click.stop="openAi()">
          <Astroid class="fpdf-icon" />
        </button>
        <div ref="moreRoot" class="foxycape-pdf-mark-toolbar__more-wrap">
          <button type="button" class="foxycape-pdf-mark-toolbar__btn clickable-icon" :aria-label="labels.more()" :aria-expanded="moreOpen" @click.stop="moreOpen = !moreOpen">
            <EllipsisVertical class="fpdf-icon" />
          </button>
          <div v-if="moreOpen" class="foxycape-pdf-toolbar-more" @pointerdown.stop>
            <button
              v-for="item in overflowItems"
              :key="item.id"
              type="button"
              class="clickable-icon foxycape-pdf-toolbar-more__item"
              @click.stop="runOverflow(item.run)"
            >
              <Highlighter v-if="item.id === 'displayMarkPenInToolbar'" class="fpdf-icon" />
              <SpellCheck2 v-else-if="item.id === 'displayWavyInToolbar'" class="fpdf-icon" />
              <Baseline v-else-if="item.id === 'displayUnderlineInToolbar'" class="fpdf-icon" />
              <Languages v-else-if="item.id === 'displayTranslateInToolbar'" class="fpdf-icon" />
              <MessageCircleQuestionMark v-else-if="item.id === 'displayExplainPassageInToolbar'" class="fpdf-icon" />
              <BookA v-else-if="item.id === 'displayLookupWordInToolbar'" class="fpdf-icon" />
              <Astroid v-else class="fpdf-icon" />
              {{ item.label }}
            </button>
            <div v-if="overflowItems.length > 0" class="foxycape-pdf-toolbar-more__rule" />
            <button type="button" class="clickable-icon foxycape-pdf-toolbar-more__item" @click.stop="openToolbarSettings">
              <Settings class="fpdf-icon" />
              {{ t('ai_toolbar_settings', 'Settings') }}
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
