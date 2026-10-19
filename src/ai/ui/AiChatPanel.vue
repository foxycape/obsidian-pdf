<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  ArrowUp,
  ArrowRight,
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
  Search,
  Settings,
  Square,
  Trash2,
  X,
} from '@lucide/vue'
import { getLanguage, Notice, TFile, type App } from 'obsidian'
import { calcToolbarPosition } from '@foxycape/core/kernal/html/geometry'
import type { Reader } from '@foxycape/core/kernal'
import type { IMarker } from '@/mark'
import type { DexieStorage } from '@/storage/DexieStorage'
import { isObsidianMobile } from '@/ui/isObsidianMobile'
import { AiAccessError } from '../errors'
import {
  createEmptyPdfChat,
  deletePdfChat,
  listPdfChats,
  loadPdfChatById,
  rememberPdfSource,
  savePdfChat,
  sendPdfChat,
  messageDisplayInput,
  type ChatMessage,
  type PdfChat,
  type PdfChatSource,
} from '../chat/chatService'
import { toCopyableAssistantMarkdown } from '../chat/copyCitationMarkdown'
import type { DocumentCitation } from '../chat/types'
import { jumpToPdfCitation } from '../chat/gotoCitation'
import { buildPdfMarkdownLink, type PdfMarkdownLinkSource } from '@/obsidian/remotePdfLink'
import { buildPdfDeepLinkFragment } from '@/obsidian/selectionLink'
import { fetchRelatedQuestions } from '../chat/relatedQuestions'
import { loadReplyLanguage } from '../prefs'
import { findListedLanguage, loadEdgeLanguages } from '../translate/edgeLanguages'
import { onInuseModelChange } from '../llm/inuseModelChange'
import { resolveInuseModelLabel } from '../llm/inuseModelLabel'
import { clearDeclinedSegments, ensurePdfSegmentSummaries, readSegmentCache } from '../summary/segments'
import { formatDisplayDate } from '@/sidebar/mark-list/formatDisplayDate'
import { useHistoryLayer } from '@/history/useHistoryLayer'
import { useDismissOnOutside } from '@/ui/useDismissOnOutside'
import MarkdownContent from './MarkdownContent.vue'
import { findKeywordRange, highlightRange, scrollRangeIntoView } from './scrollToSearchHit'
import { useChatScroller } from './useChatScroller'

const props = defineProps<{
  reader: Reader
  storage: DexieStorage
  app: App
  openCitedFile: (file: TFile, subpath?: string) => Promise<void>
  openCitedUrl: (url: string, subpath?: string) => Promise<void>
  getLinkSource?: () => PdfMarkdownLinkSource | null
  getMarker: () => IMarker | undefined
  simpleId: string
  quote: string
  prompt?: string
  autoSend?: boolean
  displayInput?: string
  sendToken?: number
  pdfTitle: string
  filePath?: string
  sourceUrl?: string
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
const historyFilter = ref<'current' | 'all'>('current')
const historySearchOpen = ref(false)
const historyKeyword = ref('')
const pendingDelete = ref<PdfChat | null>(null)
const menuMessageId = ref('')
const moreRoot = ref<HTMLElement | null>(null)
const historyRoot = ref<HTMLElement | null>(null)
const historySearchEl = ref<HTMLInputElement | null>(null)
const messageMenuRoots = new Map<string, HTMLElement>()
const citation = ref<DocumentCitation | null>(null)
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
useDismissOnOutside(
  () => historyOpen.value,
  () => [historyRoot.value, moreRoot.value],
  () => {
    historyOpen.value = false
    pendingDelete.value = null
  },
)
useHistoryLayer(historyOpen, () => {
  historyOpen.value = false
  pendingDelete.value = null
})
useHistoryLayer(
  () => !!consent.value,
  () => {
    consent.value?.resolve(false)
    consent.value = null
  },
)

const title = computed(() => chat.value?.title || props.t('ai_chat_title', 'Ask AI'))

const chatTime = (value: number) =>
  formatDisplayDate(value, {
    locale: getLanguage() || 'en',
    todayLabel: props.t('pdf_date_today', 'Today'),
    yesterdayLabel: props.t('pdf_date_yesterday', 'Yesterday'),
  })

type HistoryHit = {
  key: string
  messageId: string
  occurrence: number
  snippet: string
}

const searchableText = (message: ChatMessage) => {
  const display = messageDisplayInput(message)
  const body = message.content || ''
  if (display && display !== body) {
    return `${display}\n${body}`
  }
  return display || body
}

const findHits = (item: PdfChat, keyword: string): HistoryHit[] => {
  const hits: HistoryHit[] = []
  for (const message of item.messages) {
    const text = searchableText(message)
    const lower = text.toLowerCase()
    let from = 0
    let occurrence = 0
    while (from < lower.length && hits.length < 30) {
      const index = lower.indexOf(keyword, from)
      if (index < 0) {
        break
      }
      const start = Math.max(0, index - 24)
      const end = Math.min(text.length, index + keyword.length + 48)
      const snippet = `${start > 0 ? '…' : ''}${text.slice(start, end).replace(/\s+/g, ' ')}${end < text.length ? '…' : ''}`
      hits.push({
        key: `${message.id}:${occurrence}`,
        messageId: message.id,
        occurrence,
        snippet,
      })
      occurrence += 1
      from = index + Math.max(keyword.length, 1)
    }
  }
  return hits
}

const historyRows = computed(() => {
  const source =
    historyFilter.value === 'current'
      ? chats.value.filter((item) => item.simpleId === props.simpleId)
      : chats.value
  const keyword = historyKeyword.value.trim().toLowerCase()
  if (!keyword) {
    return source.map((item) => ({ chat: item, hits: [] as HistoryHit[] }))
  }
  return source
    .map((item) => ({ chat: item, hits: findHits(item, keyword) }))
    .filter((row) => row.hits.length > 0)
})

const snippetParts = (snippet: string) => {
  const keyword = historyKeyword.value.trim()
  if (!keyword) {
    return [{ text: snippet, match: false }]
  }
  const lower = snippet.toLowerCase()
  const needle = keyword.toLowerCase()
  const parts: { text: string; match: boolean }[] = []
  let from = 0
  while (from < snippet.length) {
    const index = lower.indexOf(needle, from)
    if (index < 0) {
      parts.push({ text: snippet.slice(from), match: false })
      break
    }
    if (index > from) {
      parts.push({ text: snippet.slice(from, index), match: false })
    }
    parts.push({ text: snippet.slice(index, index + needle.length), match: true })
    from = index + needle.length
  }
  return parts
}

const toggleMore = () => {
  moreOpen.value = !moreOpen.value
  if (moreOpen.value) {
    void refreshMenuLabels()
  }
}

const toggleHistory = () => {
  moreOpen.value = false
  if (historyOpen.value) {
    historyOpen.value = false
    pendingDelete.value = null
    return
  }
  historyOpen.value = true
  pendingDelete.value = null
  void reloadChats()
}

const toggleHistorySearch = async () => {
  historySearchOpen.value = !historySearchOpen.value
  if (!historySearchOpen.value) {
    historyKeyword.value = ''
    return
  }
  await nextTick()
  historySearchEl.value?.focus()
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

const scrollMessageToTop = (scroller: HTMLElement, message: HTMLElement) => {
  const top = message.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
  scroller.scrollTo({ top: Math.max(0, top - 8) })
}

const revealSearchHit = (focus: { messageId: string; keyword?: string; occurrence?: number }) => {
  const scroller = listEl.value
  if (!scroller) {
    return false
  }
  const message = scroller.querySelector(`[data-message-id="${CSS.escape(focus.messageId)}"]`)
  if (!(message instanceof HTMLElement)) {
    return false
  }
  const keyword = focus.keyword?.trim()
  if (!keyword) {
    scrollMessageToTop(scroller, message)
    return true
  }
  const textRoot = message.querySelector('[data-ai-search-text]')
  const root = textRoot instanceof HTMLElement ? textRoot : message
  const range = findKeywordRange(root, keyword, focus.occurrence ?? 0)
  if (!range) {
    scrollMessageToTop(scroller, message)
    return false
  }
  const scrolled = scrollRangeIntoView(scroller, range)
  if (!scrolled) {
    scrollMessageToTop(scroller, message)
    return false
  }
  highlightRange(range)
  return true
}

const openChat = async (
  item: PdfChat | null,
  focus?: { messageId?: string; toStart?: boolean; keyword?: string; occurrence?: number },
) => {
  chat.value = item
  messages.value = item?.messages ?? []
  historyOpen.value = false
  moreOpen.value = false
  pendingDelete.value = null
  await nextTick()
  if (focus?.messageId && listEl.value) {
    const target = {
      messageId: focus.messageId,
      keyword: focus.keyword,
      occurrence: focus.occurrence,
    }
    if (!revealSearchHit(target)) {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve())
      })
      revealSearchHit(target)
    }
    return
  }
  if (focus?.toStart && listEl.value) {
    listEl.value.scrollTop = 0
    return
  }
  await follow('force')
}
const refreshDeclined = async () => {
  const cache = await readSegmentCache(props.storage, props.simpleId)
  analysisDeclined.value = cache?.status === 'declined'
}

const reloadChats = async () => {
  chats.value = await listPdfChats(props.storage)
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

const pdfSource = (): PdfChatSource => ({
  pdfTitle: props.pdfTitle || undefined,
  filePath: props.filePath || undefined,
  sourceUrl: props.sourceUrl || undefined,
})

const ensureCurrentChat = async () => {
  const current = chat.value
  if (current?.id && current.simpleId === props.simpleId) {
    return current
  }
  const created = await createEmptyPdfChat(props.storage, props.simpleId, pdfSource())
  chat.value = created
  return created
}

const sendText = async (text: string, displayInput?: string) => {
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
  const visibleInput = displayInput?.trim() || ''
  let currentChatId = ''
  try {
    const current = await ensureCurrentChat()
    currentChatId = current.id
    const previousAssistantId = [...messages.value].reverse().find((message) => message.role === 'assistant')?.id
    messages.value = [
      ...messages.value,
      {
        id: `u-${now}`,
        chatId: currentChatId,
        role: 'user',
        input: trimmed,
        content: trimmed,
        contents: visibleInput ? [{ type: 'user', content: trimmed, displayInput: visibleInput }] : undefined,
        quote: quote || undefined,
        createdAt: now,
        state: 'done',
      },
      {
        id: assistantId,
        chatId: currentChatId,
        role: 'assistant',
        input: '',
        content: '',
        createdAt: now,
        state: 'generating',
      },
    ]
    quoteText.value = ''
    pendingAssistantId.value = assistantId
    reasoningOpen.value = {
      ...reasoningOpen.value,
      ...(previousAssistantId ? { [previousAssistantId]: false } : {}),
      [assistantId]: true,
    }
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
    const result = await sendPdfChat({
      reader: props.reader,
      storage: props.storage,
      simpleId: props.simpleId,
      chatId: currentChatId,
      text: trimmed,
      displayInput: visibleInput || undefined,
      quote: quote || undefined,
      pdfTitle: props.pdfTitle || undefined,
      filePath: props.filePath || undefined,
      sourceUrl: props.sourceUrl || undefined,
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
    if (chat.value?.id === result.id) {
      chat.value = result
      messages.value = result.messages
      reasoningOpen.value = { ...reasoningOpen.value, [assistantId]: false }
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
    const latest = await loadPdfChatById(props.storage, result.id)
    if (!latest || chat.value?.id !== result.id) {
      return
    }
    const next = latest.messages.map((message, index) =>
      index === latest.messages.length - 1 && message.role === 'assistant'
        ? { ...message, relatedQuestions: questions }
        : message,
    )
    const saved = { ...latest, messages: next }
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

const newChat = async () => {
  moreOpen.value = false
  if (!props.simpleId) {
    return
  }
  const current = chat.value
  if (
    current &&
    current.simpleId === props.simpleId &&
    current.messages.length === 0 &&
    messages.value.length === 0
  ) {
    quoteText.value = ''
    return
  }
  const created = await createEmptyPdfChat(props.storage, props.simpleId, pdfSource())
  chat.value = created
  messages.value = []
  quoteText.value = ''
  reasoningOpen.value = {}
  await reloadChats()
}

const removeChat = async (item: PdfChat) => {
  await deletePdfChat(props.storage, item.id)
  if (chat.value?.id === item.id) {
    chat.value = null
    messages.value = []
    quoteText.value = ''
  }
  pendingDelete.value = null
  await reloadChats()
}

const confirmDelete = async () => {
  const item = pendingDelete.value
  if (!item) {
    return
  }
  await removeChat(item)
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
  await sendText(previous.content, messageDisplayInput(previous) || undefined)
}

const citationMarkdownLink = (citation: DocumentCitation) => {
  const pageNumber = citation.pageNumber
  const start = citation.startTextOffset
  const end = citation.endTextOffset
  if (!pageNumber || pageNumber < 1 || start == null || end == null || end <= start) {
    return ''
  }
  const live = props.getLinkSource?.() ?? null
  const storedPath = props.filePath || chat.value?.filePath || ''
  const stored = storedPath ? props.app.vault.getAbstractFileByPath(storedPath) : null
  const storedFile = stored instanceof TFile ? stored : undefined
  const source: PdfMarkdownLinkSource = live?.pdfFile
    ? { app: live.app, pdfFile: live.pdfFile }
    : live?.sourceUrl
      ? { app: live.app, sourceUrl: live.sourceUrl }
      : {
          app: props.app,
          pdfFile: storedFile,
          sourceUrl: storedFile ? undefined : props.sourceUrl || chat.value?.sourceUrl || undefined,
        }
  if (!source.pdfFile && !source.sourceUrl) {
    return ''
  }
  const subpath = buildPdfDeepLinkFragment({
    pageNumber,
    textOffset: `${Math.floor(start)},${Math.floor(end)}`,
  })
  return buildPdfMarkdownLink(source, subpath, '↗')
}

const copyMessage = async (message: ChatMessage) => {
  const text =
    message.role === 'assistant'
      ? toCopyableAssistantMarkdown(visibleText(message), message.citations, citationMarkdownLink)
      : visibleText(message)
  await navigator.clipboard.writeText(text)
  menuMessageId.value = ''
  new Notice(props.t('share_copy_success_tip', 'Copied to clipboard'))
}

const isGeneratingMessage = (message: ChatMessage) =>
  loading.value && message.id === pendingAssistantId.value

const lastAssistantId = computed(() => {
  for (let index = messages.value.length - 1; index >= 0; index -= 1) {
    const message = messages.value[index]
    if (message?.role === 'assistant') {
      return message.id
    }
  }
  return ''
})

const isLastAssistant = (message: ChatMessage) => message.id === lastAssistantId.value

const showThinking = (message: ChatMessage) =>
  isLastAssistant(message) &&
  (isGeneratingMessage(message) || !!message.reasoningContent?.trim())

const showRelatedQuestions = (message: ChatMessage) =>
  isLastAssistant(message) && message.state === 'done' && !!message.relatedQuestions?.length

const isThinking = (message: ChatMessage) =>
  isGeneratingMessage(message) && !(message.content || '').trim()

const toggleReasoning = (id: string) => {
  reasoningOpen.value = { ...reasoningOpen.value, [id]: reasoningOpen.value[id] !== true }
}

const onCite = (id: string, anchor: HTMLElement, message: ChatMessage) => {
  const found = message.citations?.find((item) => item.id === id)
  if (!found) {
    return
  }
  if (citation.value?.id === found.id && citationAnchor.value === anchor) {
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
  if (left < minLeft) {
    left = minLeft
  }
  citeLeft.value = left
  citeTop.value = pos.top
  await nextTick()
  const actual = popup.getBoundingClientRect()
  citeLeft.value = left + (left - actual.left)
  citeTop.value = pos.top + (pos.top - actual.top)
  citeReady.value = true
}

const gotoCitation = async (item: DocumentCitation) => {
  closeCitation()
  if (isObsidianMobile()) {
    emit('close')
  }
  const result = await jumpToPdfCitation({
    citation: item,
    currentReader: props.reader,
    storage: props.storage,
    opener: {
      app: props.app,
      openFile: props.openCitedFile,
      openUrl: props.openCitedUrl,
    },
  })
  if (result.ok === false) {
    new Notice(
      props.t('ai_open_document_to_jump', 'Could not open “{title}” to jump to this location', {
        title: result.title,
      }),
    )
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

const visibleText = (message: ChatMessage) => {
  if (message.role !== 'user') {
    return message.content
  }
  return messageDisplayInput(message) || message.content
}

/** Hidden tail so the Nth match lines up with searchableText when the visible user text differs. */
const searchTail = (message: ChatMessage) => {
  if (message.role !== 'user') {
    return ''
  }
  const display = messageDisplayInput(message)
  const body = message.content || ''
  if (!display || display === body) {
    return ''
  }
  return `\n${body}`
}

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
  await rememberPdfSource(props.storage, props.simpleId, pdfSource())
  await reloadChats()
  await refreshDeclined()
  await refreshMenuLabels()
  const latest = chats.value.find((item) => item.simpleId === props.simpleId)
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
        <button type="button" class="clickable-icon fpdf-menu-item" :class="{ 'is-active': historyOpen }" @click="toggleHistory">
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

    <div class="fpdf-chat__stage">
    <div ref="listEl" class="fpdf-chat__list">
      <article v-for="message in messages" :key="message.id" :data-message-id="message.id" class="fpdf-msg" :class="`is-${message.role}`">
        <div v-if="showThinking(message)" class="fpdf-thinking">
          <span
            v-if="message.reasoningContent"
            class="fpdf-thinking__toggle"
            role="button"
            tabindex="0"
            @click="toggleReasoning(message.id)"
            @keydown.enter.prevent="toggleReasoning(message.id)"
            @keydown.space.prevent="toggleReasoning(message.id)"
          >
            <span :class="{ 'is-shimmer': isThinking(message) }">
              {{ isThinking(message) ? t('ai_thinking', 'Thinking…') : t('ai_thoughts_completed', 'Thoughts completed.') }}
            </span>
            <ChevronUp v-if="reasoningOpen[message.id]" class="fpdf-icon fpdf-icon--sm" />
            <ChevronDown v-else class="fpdf-icon fpdf-icon--sm" />
          </span>
          <span v-else :class="{ 'is-shimmer': isThinking(message) }">
            {{ isThinking(message) ? t('ai_thinking', 'Thinking…') : t('ai_thoughts_completed', 'Thoughts completed.') }}
          </span>
        </div>
        <div v-if="isLastAssistant(message) && reasoningOpen[message.id] && message.reasoningContent" class="fpdf-reasoning">
          <MarkdownContent :content="message.reasoningContent" is-reasoning />
        </div>
        <div v-if="message.role === 'user' && (message.quote || visibleText(message))" class="fpdf-msg__bubble">
          <p v-if="message.quote" class="fpdf-quote">{{ message.quote }}</p>
          <div v-if="visibleText(message) || searchTail(message)" data-ai-search-text>
            <p v-if="visibleText(message)" class="fpdf-msg__body">{{ visibleText(message) }}</p>
            <span v-if="searchTail(message)" class="fpdf-sr-only">{{ searchTail(message) }}</span>
          </div>
        </div>
        <div v-else-if="message.role === 'assistant' && message.content" data-ai-search-text>
          <MarkdownContent
            class="fpdf-msg__body"
            :content="message.content"
            @cite="(id, anchor) => onCite(id, anchor, message)"
          />
        </div>
        <div v-if="visibleText(message) && (message.role === 'user' || !isGeneratingMessage(message))" class="fpdf-msg__tools" :ref="(el) => bindMessageMenu(message.id, el)">
        <button v-if="message.role === 'assistant'" type="button" class="clickable-icon fpdf-icon-btn" :aria-label="t('ai_copy_result', 'Copy')" @click="copyMessage(message)">
          <Copy class="fpdf-icon" />
        </button>
        <button type="button" class="clickable-icon fpdf-icon-btn" :aria-label="t('share_more', 'More')" @click="menuMessageId = menuMessageId === message.id ? '' : message.id">
          <Ellipsis class="fpdf-icon" />
        </button>
        <div v-if="menuMessageId === message.id" class="fpdf-popover fpdf-popover--message" @pointerdown.stop>
          <button v-if="message.role !== 'assistant'" type="button" class="clickable-icon fpdf-menu-item" @click="copyMessage(message)">
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
        <div v-if="showRelatedQuestions(message)" class="fpdf-related">
          <button v-for="question in message.relatedQuestions" :key="question" type="button" class="clickable-icon fpdf-text-btn" @click="sendText(question)">
            {{ question }}
          </button>
        </div>
      </article>
      <p v-if="errorText" class="fpdf-error">{{ errorText }}</p>
    </div>

    <div v-if="historyOpen" ref="historyRoot" class="fpdf-history-layer">
      <div class="fpdf-chat__history" @pointerdown.stop>
        <div class="fpdf-history-head">
          <span>{{ t('ai_history', 'History') }}</span>
          <button type="button" class="clickable-icon fpdf-icon-btn" :aria-label="t('pdf_search_close', 'Close')" @click="historyOpen = false">
            <X class="fpdf-icon fpdf-icon--sm" />
          </button>
        </div>
        <div class="fpdf-history-tools">
          <button type="button" class="clickable-icon fpdf-history-filter" :class="{ 'is-active': historyFilter === 'current' }" @click="historyFilter = 'current'">
            {{ t('ai_history_current', 'This document') }}
          </button>
          <button type="button" class="clickable-icon fpdf-history-filter" :class="{ 'is-active': historyFilter === 'all' }" @click="historyFilter = 'all'">
            {{ t('ai_history_all', 'All') }}
          </button>
          <button type="button" class="clickable-icon fpdf-icon-btn" :aria-label="t('ai_history_search', 'Search')" @click="toggleHistorySearch">
            <Search class="fpdf-icon fpdf-icon--sm" />
          </button>
        </div>
        <input
          v-if="historySearchOpen"
          ref="historySearchEl"
          v-model="historyKeyword"
          class="fpdf-history-search"
          type="search"
          :placeholder="t('ai_history_search', 'Search')"
        />
        <div v-if="pendingDelete" class="fpdf-history-confirm">
          <p>{{ t('ai_delete_chat_confirm', 'Delete chat “{name}”?', { name: pendingDelete.title || t('ai_chat_title', 'Ask AI') }) }}</p>
          <p class="fpdf-muted">{{ t('ai_delete_chat_hint', 'This cannot be undone.') }}</p>
          <div class="fpdf-history-confirm__actions">
            <button type="button" class="clickable-icon fpdf-action" @click="pendingDelete = null">{{ t('ai_cancel', 'Cancel') }}</button>
            <button type="button" class="clickable-icon fpdf-action mod-warning" @click="confirmDelete">{{ t('share_delete', 'Delete') }}</button>
          </div>
        </div>
        <div v-else class="fpdf-history-scroll">
          <div v-for="row in historyRows" :key="row.chat.id" class="fpdf-history-group">
            <div class="fpdf-history-row" :class="{ 'is-current': row.chat.id === chat?.id }">
              <button type="button" class="clickable-icon fpdf-history-row__main" @click="openChat(row.chat, { toStart: true })">
                <span class="fpdf-history-row__title">{{ row.chat.title || t('ai_chat_title', 'Ask AI') }}</span>
                <span v-if="row.chat.pdfTitle" class="fpdf-muted fpdf-history-row__doc">{{ row.chat.pdfTitle }}</span>
                <span class="fpdf-muted" :title="chatTime(row.chat.updatedAt).title">{{ chatTime(row.chat.updatedAt).label }}</span>
              </button>
              <button type="button" class="clickable-icon fpdf-icon-btn" :aria-label="t('share_delete', 'Delete')" @click="pendingDelete = row.chat">
                <Trash2 class="fpdf-icon fpdf-icon--sm" />
              </button>
            </div>
            <button
              v-for="hit in row.hits"
              :key="hit.key"
              type="button"
              class="clickable-icon fpdf-history-hit"
              @click="openChat(row.chat, { messageId: hit.messageId, keyword: historyKeyword.trim(), occurrence: hit.occurrence })"
            >
              <span v-for="(part, partIndex) in snippetParts(hit.snippet)" :key="partIndex">
                <mark v-if="part.match" class="fpdf-history-hit__mark">{{ part.text }}</mark>
                <template v-else>{{ part.text }}</template>
              </span>
            </button>
          </div>
          <p v-if="historyRows.length === 0" class="fpdf-muted fpdf-history-empty">
            {{
              historyKeyword.trim()
                ? t('ai_history_search_empty', 'No chats match the search')
                : historyFilter === 'all'
                  ? t('ai_history_empty_all', 'No chats yet')
                  : t('ai_history_empty', 'No chats for this PDF')
            }}
          </p>
        </div>
      </div>
    </div>
    </div>

    <Teleport to="body">
    <div
      v-if="citation"
      ref="citePopEl"
      class="fpdf-cite-pop"
      :class="{ 'is-ready': citeReady }"
      :style="{ left: `${citeLeft}px`, top: `${citeTop}px` }"
      @pointerdown.stop
    >
      <div class="fpdf-cite-pop__bar">
        <p class="fpdf-cite-pop__title">{{ citation.navPointTitle || citation.resourceTitle }}</p>
        <button type="button" class="clickable-icon fpdf-icon-btn" :aria-label="t('ai_goto_page', 'Go to page')" @click="gotoCitation(citation)">
          <ArrowRight class="fpdf-icon fpdf-icon--sm" />
        </button>
      </div>
      <div class="fpdf-cite-pop__body">
        <p>{{ citation.snippet }}</p>
      </div>
    </div>
    </Teleport>

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
        <textarea v-model="draft" rows="1" :placeholder="t('ai_chat_placeholder', 'Ask AI …')" @keydown.enter.exact.prevent="sendDraft" />
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
