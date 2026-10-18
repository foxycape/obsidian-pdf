<script setup lang="ts">
import { markRaw, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { Reader } from '@foxycape/core/kernal'
import type { IMarker } from '@/mark'
import type { DexieStorage } from '@/storage/DexieStorage'
import { LICENSE_PURCHASE_URL } from '@/license/constants'
import { setAiChromeHooks } from '../runtime'
import type { AiAccessMode } from '../accessChoice'
import { useHistoryLayer } from '@/history/useHistoryLayer'
import AiAccessChoiceDialog from './AiAccessChoiceDialog.vue'
import AiChatPanel from './AiChatPanel.vue'
import AiLanguageDialog from './AiLanguageDialog.vue'
import ModelSettingsDialog from './ModelSettingsDialog.vue'

export type AiChatDraft = {
  simpleId: string
  quote: string
  prompt?: string
  autoSend?: boolean
  displayInput?: string
  pdfTitle?: string
}

const props = defineProps<{
  storage: DexieStorage
  t: (key: string, fallback: string, named?: object) => string
  openSettings: () => void
}>()

const reader = shallowRef<Reader | null>(null)
const getMarker = ref<(() => IMarker | undefined) | null>(null)
const draft = ref<AiChatDraft | null>(null)
const sendToken = ref(0)
const chatOpen = ref(false)
const accessOpen = ref(false)
const accessMode = ref<AiAccessMode>('need-license')
const modelOpen = ref(false)
const languageOpen = ref(false)

useHistoryLayer(chatOpen, () => {
  chatOpen.value = false
})
useHistoryLayer(accessOpen, () => {
  accessOpen.value = false
})
useHistoryLayer(modelOpen, () => {
  modelOpen.value = false
})
useHistoryLayer(languageOpen, () => {
  languageOpen.value = false
})

const openAccess = (mode: AiAccessMode) => {
  accessMode.value = mode
  accessOpen.value = true
}

const openChat = (nextReader: Reader, marker: () => IMarker | undefined, next: AiChatDraft) => {
  reader.value = markRaw(nextReader)
  getMarker.value = marker
  draft.value = next
  if (next.autoSend && next.prompt?.trim()) {
    sendToken.value += 1
  }
  chatOpen.value = true
}

const openModel = () => {
  modelOpen.value = true
}

const openLanguage = () => {
  languageOpen.value = true
}

const purchase = () => {
  window.open(LICENSE_PURCHASE_URL, '_blank', 'noopener')
}

const AI_WIDTH_KEY = 'foxycape-pdf.aiPanelWidth'
const MIN_AI_WIDTH = 280
const DEFAULT_AI_WIDTH = 360
const MAX_AI_WIDTH_RATIO = 0.5

const chromeRoot = ref<HTMLElement | null>(null)

const readAiWidth = () => {
  try {
    const raw = localStorage.getItem(AI_WIDTH_KEY)
    const value = raw ? Number.parseFloat(raw) : Number.NaN
    return Number.isFinite(value) && value >= MIN_AI_WIDTH ? value : DEFAULT_AI_WIDTH
  } catch {
    return DEFAULT_AI_WIDTH
  }
}

const writeAiWidth = (value: number) => {
  try {
    localStorage.setItem(AI_WIDTH_KEY, String(Math.round(value)))
  } catch {
    /* private mode */
  }
}

const clampAiWidth = (width: number) => {
  const host = chromeRoot.value?.closest('.foxycape-pdf-ai-host')
  const container = host?.parentElement?.clientWidth ?? window.innerWidth
  const max = Math.max(MIN_AI_WIDTH, container * MAX_AI_WIDTH_RATIO)
  return Math.min(max, Math.max(MIN_AI_WIDTH, width))
}

const applyAiWidth = (width: number) => {
  const host = chromeRoot.value?.closest('.foxycape-pdf-ai-host')
  if (!(host instanceof HTMLElement)) {
    return
  }
  host.style.setProperty('--foxycape-pdf-ai-width', `${Math.round(width)}px`)
}

let resizeSession: { startX: number; startWidth: number; sign: number } | null = null

const onAiResizeMove = (event: PointerEvent) => {
  if (!resizeSession) {
    return
  }
  const next = resizeSession.startWidth + (resizeSession.startX - event.clientX) * resizeSession.sign
  applyAiWidth(clampAiWidth(next))
}

const endAiResize = () => {
  if (resizeSession) {
    const host = chromeRoot.value?.closest('.foxycape-pdf-ai-host')
    const raw = host instanceof HTMLElement ? host.style.getPropertyValue('--foxycape-pdf-ai-width') : ''
    const width = Number.parseFloat(raw)
    if (Number.isFinite(width)) {
      writeAiWidth(width)
    }
  }
  resizeSession = null
  document.body.classList.remove('foxycape-pdf-resizing')
  window.removeEventListener('pointermove', onAiResizeMove)
  window.removeEventListener('pointerup', endAiResize)
}

const beginAiResize = (event: PointerEvent) => {
  if (document.body.classList.contains('is-mobile')) {
    return
  }
  event.preventDefault()
  const host = chromeRoot.value?.closest('.foxycape-pdf-ai-host')
  const current = host instanceof HTMLElement ? Number.parseFloat(host.style.getPropertyValue('--foxycape-pdf-ai-width')) : DEFAULT_AI_WIDTH
  resizeSession = {
    startX: event.clientX,
    startWidth: Number.isFinite(current) ? current : readAiWidth(),
    sign: host instanceof HTMLElement && getComputedStyle(host).direction === 'rtl' ? -1 : 1,
  }
  document.body.classList.add('foxycape-pdf-resizing')
  window.addEventListener('pointermove', onAiResizeMove)
  window.addEventListener('pointerup', endAiResize)
}

watch(chatOpen, (open) => {
  if (open) {
    applyAiWidth(clampAiWidth(readAiWidth()))
  }
})

let widthObserver: ResizeObserver | null = null

const syncStoredWidth = () => {
  if (resizeSession || !chatOpen.value) {
    return
  }
  applyAiWidth(clampAiWidth(readAiWidth()))
}

onMounted(() => {
  setAiChromeHooks({ openAccess })
  const parent = chromeRoot.value?.closest('.foxycape-pdf-ai-host')?.parentElement
  if (parent) {
    widthObserver = new ResizeObserver(() => {
      syncStoredWidth()
    })
    widthObserver.observe(parent)
  }
  if (chatOpen.value) {
    applyAiWidth(clampAiWidth(readAiWidth()))
  }
})

onBeforeUnmount(() => {
  endAiResize()
  widthObserver?.disconnect()
  widthObserver = null
  setAiChromeHooks(null)
})

const isChatOpen = () => chatOpen.value

defineExpose({
  openChat,
  isChatOpen,
  openAccess,
  openModel,
  openLanguage,
  close: () => {
    chatOpen.value = false
  },
})
</script>

<template>
  <div ref="chromeRoot" class="fpdf-chrome" :class="{ 'is-chat-open': chatOpen }">
    <div
      v-if="chatOpen"
      class="foxycape-pdf-ai-resizer"
      role="separator"
      aria-orientation="vertical"
      @pointerdown="beginAiResize"
    />
    <AiChatPanel
      v-if="chatOpen && reader && getMarker && draft"
      :reader="reader"
      :storage="storage"
      :get-marker="getMarker"
      :simple-id="draft.simpleId"
      :quote="draft.quote"
      :prompt="draft.prompt"
      :auto-send="draft.autoSend"
      :display-input="draft.displayInput"
      :send-token="sendToken"
      :pdf-title="draft.pdfTitle || ''"
      :t="t"
      @close="chatOpen = false"
      @open-model="openModel"
      @open-language="openLanguage"
    />
    <div v-if="accessOpen || modelOpen || languageOpen" class="fpdf-dialog-layer">
    <AiAccessChoiceDialog
      v-if="accessOpen"
      :mode="accessMode"
      :t="t"
      @close="accessOpen = false"
      @configure-key="accessOpen = false; openModel()"
      @enter-license="accessOpen = false; openSettings()"
      @purchase="purchase"
    />
    <ModelSettingsDialog v-if="modelOpen" :t="t" @close="modelOpen = false" />
    <AiLanguageDialog v-if="languageOpen" :t="t" @close="languageOpen = false" />
    </div>
  </div>
</template>
