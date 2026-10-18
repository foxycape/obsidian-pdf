<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  ArrowUp,
  BookOpen,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  Ellipsis,
  Languages,
  MessageCircleMore,
  MessageCirclePlus,
  RefreshCw,
  Settings,
  Square,
  Trash2,
  X,
} from '@lucide/vue'
import { Notice } from 'obsidian'
import { calcToolbarPosition } from '@foxycape/core/kernal/html/geometry'
import type { Reader } from '@foxycape/core/kernal'
import type { IMarker } from '@/mark'
import { getPdfRenderer } from '@/chrome/usePdfRenderer'
import { flashPassageText } from '@/marker/flashPassageText'
import type { DexieStorage } from '@/storage/DexieStorage'
import { AiAccessError } from '../errors'
import {
  deletePdfChat,
  listPdfChats,
  loadPdfChatById,
  savePdfChat,
  sendPdfChat,
  type ChatMessage,
  type PdfChat,
} from '../chat/chatService'
import { fetchRelatedQuestions } from '../chat/relatedQuestions'
import { loadReplyLanguage } from '../prefs'
import { findListedLanguage, loadEdgeLanguages } from '../translate/edgeLanguages'
import { onInuseModelChange } from '../llm/inuseModelChange'
import { resolveInuseModelLabel } from '../llm/inuseModelLabel'
import { clearDeclinedSegments, ensurePdfSegmentSummaries, readSegmentCache } from '../summary/segments'
import type { BookCitation } from '../tools/bookTools'
import { useHistoryLayer } from '@/history/useHistoryLayer'
import { useDismissOnOutside } from '@/ui/useDismissOnOutside'
import MarkdownContent from './MarkdownContent.vue'
import { useChatScroller } from './useChatScroller'

const props = defineProps<{
  reader: Reader
  storage: DexieStorage
  getMarker: () => IMarker | undefined
  simpleId: string
  quote: string
  prompt?: string
  autoSend?: boolean
  displayInput?: string
  sendToken?: number
  pdfTitle: string
  t: (key: string, fallback: string, named?: object) => string
}>()

const emit = defineEmits<{
  close: []
  openModel: []
  openLanguage: []
}>()

const chat = ref<PdfChat | null>(null)
const messages = ref<ChatMessage[]>([])
const chats = ref<PdfChat[]>([])
const draft = ref('')
const quoteText = ref(props.quote)
const loading = ref(false)
const errorText = ref('')
const moreOpen = ref(false)
const historyOpen = ref(false)
const menuMessageId = ref('')
const moreRoot = ref<HTMLElement | null>(null)
const messageMenuRoots = new Map<string, HTMLElement>()
const citation = ref<BookCitation | null>(null)
const citationAnchor = ref<HTMLElement | null>(null)
const citePopEl = ref<HTMLElement | null>(null)
const citeLeft = ref(0)
const citeTop = ref(0)
const citeReady = ref(false)
const consent = ref<{ count: number; resolve: (accepted: boolean) => void } | null>(null)
const preprocess = ref<{ phase: 'extract' | 'summarize'; done: number; total: number } | null>(null)
const analysisDeclined = ref(false)
const modelLabel = ref('')
const replyLanguageTitle = ref('')
const listEl = ref<HTMLElement | null>(null)
const { pin, unpin, follow, followThrottled } = useChatScroller(listEl)
const pendingAssistantId = ref('')
const reasoningOpen = ref<Record<string, boolean>>({})
let abort: AbortController | null = null

useHistoryLayer(moreOpen, () => {
  moreOpen.value = false
})

const bindMessageMenu = (id: string, el: unknown) => {
  if (el instanceof HTMLElement) {
    messageMenuRoots.set(id, el)
    return
  }
  messageMenuRoots.delete(id)
}

useDismissOnOutside(
  () => moreOpen.value,
  () => [moreRoot.value],
  () => {
    moreOpen.value = false
  },
)
useDismissOnOutside(
  () => menuMessageId.value !== '',
  () => [messageMenuRoots.get(menuMessageId.value)],
  () => {
    menuMessageId.value = ''
  },
)
useHistoryLayer(historyOpen, () => {
  historyOpen.value = false
})
useHistoryLayer(
  () => !!consent.value,
  () => {
    consent.value?.resolve(false)
    consent.value = null
  },
)

const title = computed(() => chat.value?.title || props.t('ai_chat_title', 'Ask AI'))

const formatChatTime = (value: number) =>
  new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

const toggleMore = () => {
  moreOpen.value = !moreOpen.value
  if (moreOpen.value) {
    void refreshMenuLabels()
  }
}

const refreshMenuLabels = async () => {
  try {
    modelLabel.value = await resolveInuseModelLabel(props.t)
  } catch {
    modelLabel.value = ''
  }
  const [languages, current] = await Promise.all([loadEdgeLanguages(), loadReplyLanguage()])
  replyLanguageTitle.value = findListedLanguage(languages, current.code).title
}

const openChat = async (item: PdfChat | null) => {
  chat.value = item
  messages.value = item?.messages ?? []
  historyOpen.value = false
  moreOpen.value = false
  await follow('force')
}
const refreshDeclined = async () => {
  const cache = await readSegmentCache(props.storage, props.simpleId)
  analysisDeclined.value = cache?.status === 'declined'
}

const reloadChats = async () => {
  chats.value = await listPdfChats(props.storage, props.simpleId)
}

const askConsent = (charCount: number) =>
  new Promise<boolean>((resolve) => {
    consent.value = { count: charCount, resolve }
  })

const settleConsent = (accepted: boolean) => {
  consent.value?.resolve(accepted)
  consent.value = null
}

const languageCode = async () => (await loadReplyLanguage()).code

const sendText = async (text: string, displayText?: string) => {
  const trimmed = text.trim()
  if (!trimmed || loading.value || !props.simpleId) {
    return
  }
  loading.value = true
  errorText.value = ''
  abort = new AbortController()
  const quote = quoteText.value.trim()
  const now = Date.now()
  const assistantId = `a-${now}`
  messages.value = [
    ...messages.value,
    {
      id: `u-${now}`,
      role: 'user',
      content: trimmed,
      displayText: displayText?.trim() || undefined,
      quote: quote || undefined,
      createdAt: now,
    },
    {
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: now,
    },
  ]
  quoteText.value = ''
  const previousAssistantId = pendingAssistantId.value
  pendingAssistantId.value = assistantId
  const nextReasoning = { ...reasoningOpen.value, [assistantId]: true }
  if (previousAssistantId) {
    nextReasoning[previousAssistantId] = false
  }
  reasoningOpen.value = nextReasoning
  pin()
  void follow('force')
  const applyLive = (patch: { content?: string; reasoningContent?: string }) => {
    messages.value = messages.value.map((message) => {
      if (message.id !== assistantId) {
        return message
      }
      return {
        ...message,
        ...(patch.content != null ? { content: patch.content } : {}),
        ...(patch.reasoningContent != null ? { reasoningContent: patch.reasoningContent } : {}),
      }
    })
    followThrottled()
  }
  try {
    const result = await sendPdfChat({
      reader: props.reader,
      storage: props.storage,
      simpleId: props.simpleId,
      chatId: chat.value?.id,
      text: trimmed,
      displayText: displayText?.trim() || undefined,
      quote: quote || undefined,
      responseLanguage: await languageCode(),
      askLongTextConsent: askConsent,
      signal: abort.signal,
      onStatus: (status) => {
        if (status === 'extract' || status === 'summarize') {
          preprocess.value = {
            phase: status,
            done: preprocess.value?.phase === status ? preprocess.value.done : 0,
            total: preprocess.value?.phase === status ? preprocess.value.total : 0,
          }
          return
        }
        preprocess.value = null
      },
      onProgress: (done, total) => {
        preprocess.value = { phase: 'summarize', done, total }
      },
      onUpdate: (patch) => {
        preprocess.value = null
        applyLive(patch)
      },
    })
    chat.value = result
    messages.value = result.messages
    const savedAssistant = result.messages[result.messages.length - 1]
    if (reasoningOpen.value[assistantId] === true && savedAssistant?.role === 'assistant') {
      reasoningOpen.value = { ...reasoningOpen.value, [savedAssistant.id]: true }
    }
    void attachQuestions(result)
    await reloadChats()
    await refreshDeclined()
  } catch (error) {
    messages.value = messages.value.filter((message) => message.id !== `u-${now}` && message.id !== assistantId)
    if (error instanceof DOMException && error.name === 'AbortError') {
      return
    }
    if (error instanceof AiAccessError && (error.code === 'no-ai-token' || error.code === 'license-required')) {
      errorText.value = ''
    } else {
      errorText.value = error instanceof Error ? error.message : props.t('ai_chat_failed', 'The request failed')
    }
  } finally {
    loading.value = false
    pendingAssistantId.value = ''
    preprocess.value = null
    abort = null
    await follow()
    unpin()
    void maybeAutoSend()
  }
}

const attachQuestions = async (result: PdfChat) => {
  try {
    const questions = await fetchRelatedQuestions({
      messages: result.messages,
      language: await languageCode(),
    })
    if (!questions.length || chat.value?.id !== result.id) {
      return
    }
    const next = result.messages.map((message, index) =>
      index === result.messages.length - 1 ? { ...message, relatedQuestions: questions } : message,
    )
    const saved = { ...result, messages: next }
    await savePdfChat(props.storage, saved)
    if (chat.value?.id === result.id) {
      chat.value = saved
      messages.value = next
    }
  } catch {
    // Related questions are optional.
  }
}

const sendDraft = async () => {
  const text = draft.value
  draft.value = ''
  await sendText(text)
}

const stop = () => {
  abort?.abort()
}

const newChat = () => {
  moreOpen.value = false
  chat.value = null
  messages.value = []
  quoteText.value = ''
}

const removeChat = async (item: PdfChat) => {
  await deletePdfChat(props.storage, item.id)
  if (chat.value?.id === item.id) {
    newChat()
  }
  await reloadChats()
}

const removeMessage = async (message: ChatMessage) => {
  if (!chat.value) {
    return
  }
  const next = chat.value.messages.filter((item) => item.id !== message.id)
  const saved = { ...chat.value, messages: next, updatedAt: Date.now() }
  await savePdfChat(props.storage, saved)
  chat.value = saved
  messages.value = next
  menuMessageId.value = ''
}

const regenerate = async (message: ChatMessage) => {
  if (!chat.value) {
    return
  }
  const index = chat.value.messages.findIndex((item) => item.id === message.id)
  const previous = [...chat.value.messages].slice(0, index).reverse().find((item) => item.role === 'user')
  if (!previous) {
    return
  }
  const trimmed = chat.value.messages.slice(0, chat.value.messages.indexOf(previous))
  const saved = { ...chat.value, messages: trimmed, updatedAt: Date.now() }
  await savePdfChat(props.storage, saved)
  chat.value = saved
  messages.value = trimmed
  menuMessageId.value = ''
  quoteText.value = previous.quote ?? ''
  await sendText(previous.content)
}

const copyMessage = async (message: ChatMessage) => {
  await navigator.clipboard.writeText(visibleText(message))
  menuMessageId.value = ''
  new Notice(props.t('share_copy_success_tip', 'Copied to clipboard'))
}

const isGeneratingMessage = (message: ChatMessage) =>
  loading.value && message.id === pendingAssistantId.value

const showThinking = (message: ChatMessage) =>
  message.role === 'assistant' && (isGeneratingMessage(message) || !!message.reasoningContent?.trim())

const isThinking = (message: ChatMessage) =>
  isGeneratingMessage(message) && !(message.content || '').trim()

const toggleReasoning = (id: string) => {
  reasoningOpen.value = { ...reasoningOpen.value, [id]: reasoningOpen.value[id] !== true }
}

const onCite = (id: string, anchor: HTMLElement, message: ChatMessage) => {
  const found = message.citations?.find((item) => String(item.n) === id)
  if (!found) {
    return
  }
  if (citation.value?.n === found.n && citationAnchor.value === anchor) {
    closeCitation()
    return
  }
  citationAnchor.value = anchor
  citation.value = found
  citeReady.value = false
  void placeCitation()
}

const preparePercent = computed(() => {
  const state = preprocess.value
  if (!state?.total) {
    return 0
  }
  return Math.round((state.done / state.total) * 100)
})

const closeCitation = () => {
  citation.value = null
  citationAnchor.value = null
  citeReady.value = false
}

const placeCitation = async () => {
  await nextTick()
  const owner = listEl.value?.closest('.fpdf-chat')
  const popup = citePopEl.value
  const anchor = citationAnchor.value
  if (!(owner instanceof HTMLElement) || !popup || !anchor || !citation.value) {
    return
  }
  const ownerRect = owner.getBoundingClientRect()
  const maxWidth = Math.max(160, Math.min(350, ownerRect.width - 16))
  popup.style.maxWidth = `${maxWidth}px`
  popup.style.width = `${maxWidth}px`
  await nextTick()
  const pos = calcToolbarPosition(owner, anchor, popup, 'bottom')
  if (!pos.visible) {
    closeCitation()
    return
  }
  const popupWidth = popup.getBoundingClientRect().width
  const minLeft = ownerRect.left + 8
  const rightLimit = Math.min(ownerRect.right, window.innerWidth) - 8
  let left = pos.left
  if (left + popupWidth > rightLimit) {
    left = rightLimit - popupWidth
  }
  citeLeft.value = Math.max(minLeft, left)
  citeTop.value = pos.top
  citeReady.value = true
}

const gotoCitation = async (item: BookCitation) => {
  closeCitation()
  const renderer = getPdfRenderer(props.reader)
  const found = await flashPassageText(renderer, item.pageNumber, item.excerpt)
  if (!found && renderer && item.pageNumber > 0) {
    renderer.setCurrentPage(item.pageNumber, true)
  }
}

useDismissOnOutside(
  () => !!citation.value,
  () => [citePopEl.value, citationAnchor.value],
  closeCitation,
)

watch(citation, (value, _previous, onCleanup) => {
  const list = listEl.value
  if (!value || !list) {
    return
  }
  const onScroll = () => closeCitation()
  list.addEventListener('scroll', onScroll)
  window.addEventListener('resize', onScroll)
  onCleanup(() => {
    list.removeEventListener('scroll', onScroll)
    window.removeEventListener('resize', onScroll)
  })
})

const analyzeBook = async () => {
  moreOpen.value = false
  await clearDeclinedSegments(props.storage, props.simpleId)
  loading.value = true
  abort = new AbortController()
  try {
    await ensurePdfSegmentSummaries({
      reader: props.reader,
      storage: props.storage,
      simpleId: props.simpleId,
      askLongTextConsent: askConsent,
      signal: abort.signal,
      onPhase: (phase) => {
        preprocess.value = { phase, done: 0, total: 0 }
      },
      onProgress: (done, total) => {
        preprocess.value = { phase: 'summarize', done, total }
      },
    })
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'AbortError')) {
      errorText.value = error instanceof Error ? error.message : props.t('ai_chat_failed', 'The request failed')
    }
  } finally {
    loading.value = false
    preprocess.value = null
    await refreshDeclined()
  }
}

let stopInuseWatch = () => {}

const visibleText = (message: ChatMessage) => message.displayText?.trim() || message.content

let handledSendToken = 0

const maybeAutoSend = async () => {
  const token = props.sendToken ?? 0
  if (!props.autoSend || !props.prompt?.trim() || token === 0 || token === handledSendToken || loading.value) {
    return
  }
  handledSendToken = token
  quoteText.value = props.quote
  draft.value = ''
  await sendText(props.prompt, props.displayInput)
}

onMounted(async () => {
  stopInuseWatch = onInuseModelChange(() => {
    void refreshMenuLabels()
  })
  await reloadChats()
  await refreshDeclined()
  await refreshMenuLabels()
  const latest = chats.value[0]
  if (latest && !props.autoSend) {
    await openChat(latest)
  }
  await maybeAutoSend()
})

onBeforeUnmount(() => {
  stopInuseWatch()
})

watch(
  () => props.sendToken,
  () => {
    void maybeAutoSend()
  },
)

watch(
  () => props.quote,
  (value) => {
    if (value) {
      quoteText.value = value
    }
  },
)
</script>

<template>
  <div class="fpdf-chat" @pointerdown.stop>
    <header class="fpdf-chat__bar">
      <div class="fpdf-chat__center">
        <div class="fpdf-dialog__title">{{ title }}</div>
        <div v-if="pdfTitle" class="fpdf-muted">{{ pdfTitle }}</div>
      </div>
      <div ref="moreRoot" class="fpdf-chat__actions">
      <button type="button" class="clickable-icon fpdf-icon-btn" :aria-label="t('share_more', 'More')" @click="toggleMore">
        <Ellipsis class="fpdf-icon" />
      </button>
      <button type="button" class="clickable-icon fpdf-icon-btn" :aria-label="t('pdf_search_close', 'Close')" @click="emit('close')">
        <X class="fpdf-icon" />
      </button>
      <div v-if="moreOpen" class="fpdf-popover fpdf-popover--more" @pointerdown.stop>
        <button type="button" class="clickable-icon fpdf-menu-item" @click="newChat">
          <MessageCirclePlus class="fpdf-icon" />
          {{ t('ai_new_chat', 'New chat') }}
        </button>
        <button type="button" class="clickable-icon fpdf-menu-item" @click="historyOpen = true; moreOpen = false">
          <MessageCircleMore class="fpdf-icon" />
          <span class="fpdf-menu-item__label">{{ t('ai_history', 'History') }}</span>
          <ChevronRight class="fpdf-icon fpdf-icon--sm" />
        </button>
        <button v-if="analysisDeclined" type="button" class="clickable-icon fpdf-menu-item" @click="analyzeBook">
          <BookOpen class="fpdf-icon" />
          {{ t('ai_analyze_book', 'Analyze this book') }}
        </button>
        <div class="fpdf-rule" />
        <button type="button" class="clickable-icon fpdf-stack-choice fpdf-stack-choice--block" @click="moreOpen = false; emit('openModel')">
          <span class="fpdf-stack-choice__label">
            <Settings class="fpdf-icon" />
            {{ t('ai_model_settings', 'Model') }}
          </span>
          <span class="fpdf-stack-choice__value">
            <span>{{ modelLabel || t('ai_model_settings', 'Model') }}</span>
            <ChevronRight class="fpdf-icon fpdf-icon--sm" />
          </span>
        </button>
        <button type="button" class="clickable-icon fpdf-stack-choice fpdf-stack-choice--block" @click="moreOpen = false; emit('openLanguage')">
          <span class="fpdf-stack-choice__label">
            <Languages class="fpdf-icon" />
            {{ t('ai_reply_language', 'Reply language') }}
          </span>
          <span class="fpdf-stack-choice__value">
            <span>{{ replyLanguageTitle }}</span>
            <ChevronRight class="fpdf-icon fpdf-icon--sm" />
          </span>
        </button>
      </div>
      </div>
    </header>

    <div v-if="historyOpen" class="fpdf-chat__history">
      <div v-for="item in chats" :key="item.id" class="fpdf-history-row">
        <button type="button" class="clickable-icon fpdf-history-row__main" @click="openChat(item)">
          <span class="fpdf-history-row__title">{{ item.title || t('ai_chat_title', 'Ask AI') }}</span>
          <span class="fpdf-muted">{{ formatChatTime(item.updatedAt) }}</span>
        </button>
        <button type="button" class="clickable-icon fpdf-icon-btn" :aria-label="t('share_delete', 'Delete')" @click="removeChat(item)">
          <Trash2 class="fpdf-icon fpdf-icon--sm" />
        </button>
      </div>
      <p v-if="chats.length === 0" class="fpdf-muted">{{ t('ai_history_empty', 'No chats for this PDF') }}</p>
    </div>

    <div v-else ref="listEl" class="fpdf-chat__list">
      <article v-for="message in messages" :key="message.id" class="fpdf-msg" :class="`is-${message.role}`">
        <div v-if="showThinking(message)" class="fpdf-thinking">
          <button
            v-if="message.reasoningContent"
            type="button"
            class="fpdf-thinking__toggle"
            @click="toggleReasoning(message.id)"
          >
            <span :class="{ 'is-shimmer': isThinking(message) }">
              {{ isThinking(message) ? t('ai_thinking', 'Thinking…') : t('ai_thoughts_completed', 'Thoughts completed.') }}
            </span>
            <ChevronUp v-if="reasoningOpen[message.id]" class="fpdf-icon fpdf-icon--sm" />
            <ChevronDown v-else class="fpdf-icon fpdf-icon--sm" />
          </button>
          <span v-else :class="{ 'is-shimmer': isThinking(message) }">
            {{ isThinking(message) ? t('ai_thinking', 'Thinking…') : t('ai_thoughts_completed', 'Thoughts completed.') }}
          </span>
        </div>
        <div v-if="reasoningOpen[message.id] && message.reasoningContent" class="fpdf-reasoning">
          <MarkdownContent :content="message.reasoningContent" is-reasoning />
        </div>
        <p v-if="message.quote" class="fpdf-quote">{{ message.quote }}</p>
        <p v-if="message.role === 'user' && visibleText(message)" class="fpdf-msg__body">{{ visibleText(message) }}</p>
        <MarkdownContent
          v-else-if="message.role === 'assistant' && message.content"
          class="fpdf-msg__body"
          :content="message.content"
          @cite="(id, anchor) => onCite(id, anchor, message)"
        />
        <div v-if="visibleText(message) && (message.role === 'user' || !isGeneratingMessage(message))" class="fpdf-msg__tools" :ref="(el) => bindMessageMenu(message.id, el)">
        <button type="button" class="clickable-icon fpdf-icon-btn" :aria-label="t('share_more', 'More')" @click="menuMessageId = menuMessageId === message.id ? '' : message.id">
          <Ellipsis class="fpdf-icon" />
        </button>
        <div v-if="menuMessageId === message.id" class="fpdf-popover fpdf-popover--message" @pointerdown.stop>
          <button type="button" class="clickable-icon fpdf-menu-item" @click="copyMessage(message)">
            <Copy class="fpdf-icon fpdf-icon--sm" />
            {{ t('ai_copy_result', 'Copy') }}
          </button>
          <button v-if="message.role === 'assistant'" type="button" class="clickable-icon fpdf-menu-item" @click="regenerate(message)">
            <RefreshCw class="fpdf-icon fpdf-icon--sm" />
            {{ t('ai_regenerate', 'Regenerate') }}
          </button>
          <button type="button" class="clickable-icon fpdf-menu-item" @click="removeMessage(message)">
            <Trash2 class="fpdf-icon fpdf-icon--sm" />
            {{ t('share_delete', 'Delete') }}
          </button>
        </div>
        </div>
        <div v-if="message.relatedQuestions?.length" class="fpdf-related">
          <button v-for="question in message.relatedQuestions" :key="question" type="button" class="clickable-icon fpdf-text-btn" @click="sendText(question)">
            {{ question }}
          </button>
        </div>
      </article>
      <p v-if="errorText" class="fpdf-error">{{ errorText }}</p>
    </div>

    <div
      v-if="citation"
      ref="citePopEl"
      class="fpdf-cite-pop"
      :class="{ 'is-ready': citeReady }"
      :style="{ left: `${citeLeft}px`, top: `${citeTop}px` }"
      @pointerdown.stop
    >
      <div class="fpdf-cite-pop__bar">
        <p class="fpdf-cite-pop__title">{{ citation.title }}</p>
        <button type="button" class="clickable-icon fpdf-icon-btn" :aria-label="t('ai_goto_page', 'Go to page')" @click="gotoCitation(citation)">
          {{ citation.pageNumber }}
        </button>
      </div>
      <div class="fpdf-cite-pop__body">
        <p>{{ citation.excerpt }}</p>
      </div>
    </div>

    <div v-if="preprocess && !consent" class="fpdf-modal">
      <div class="fpdf-modal__backdrop" />
      <div class="fpdf-modal__card">
        <p class="fpdf-modal__title">{{ t('ai_prepare_title', 'Getting to know this book so later questions are more accurate') }}</p>
        <p class="fpdf-muted">{{ t('ai_prepare_progress', 'Analysis progress {percent}%', { percent: preparePercent }) }}</p>
        <p class="fpdf-muted">{{ t('ai_prepare_once', 'This only happens once') }}</p>
        <div class="fpdf-modal__actions">
          <button type="button" class="clickable-icon fpdf-action" @click="stop">{{ t('ai_cancel', 'Cancel') }}</button>
        </div>
      </div>
    </div>

    <div v-if="consent" class="fpdf-modal is-front">
      <div class="fpdf-modal__backdrop" />
      <div class="fpdf-modal__card">
        <p>{{ t('ai_long_text_consent', 'This document is over {count} characters and will use many tokens. Continue analyzing with AI? Yes uses the book; No answers from general knowledge.', { count: consent.count }) }}</p>
        <div class="fpdf-modal__actions">
          <button type="button" class="clickable-icon fpdf-action" @click="settleConsent(false)">{{ t('ai_no', 'No') }}</button>
          <button type="button" class="clickable-icon fpdf-action mod-cta" @click="settleConsent(true)">{{ t('ai_yes', 'Yes') }}</button>
        </div>
      </div>
    </div>

    <footer class="fpdf-composer">
      <div v-if="quoteText" class="fpdf-composer__quote">
        <span class="fpdf-muted">{{ quoteText }}</span>
        <button type="button" class="clickable-icon fpdf-icon-btn" :aria-label="t('pdf_search_clear', 'Clear')" @click="quoteText = ''">
          <X class="fpdf-icon fpdf-icon--sm" />
        </button>
      </div>
      <div class="fpdf-composer__row">
        <textarea v-model="draft" rows="1" :placeholder="t('ai_chat_placeholder', 'Ask about this passage')" @keydown.enter.exact.prevent="sendDraft" />
        <button v-if="loading" type="button" class="clickable-icon fpdf-send" :aria-label="t('ai_stop', 'Stop')" @click="stop">
          <Square class="fpdf-icon fpdf-icon--sm" />
        </button>
        <button v-else type="button" class="clickable-icon fpdf-send" :disabled="!draft.trim()" :aria-label="t('ai_chat_send', 'Send')" @click="sendDraft">
          <ArrowUp class="fpdf-icon" />
        </button>
      </div>
    </footer>
  </div>
</template>
