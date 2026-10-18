import type { Reader } from '@foxycape/core/kernal'
import { ANONYMOUS_OWNER_ID } from '@/storage/ownerId'
import type { DexieStorage } from '@/storage/DexieStorage'
import { toStorageValue } from '@/storage/toStorageValue'
import { getLlm } from '../llm'
import type { LlmMessage } from '../llm'
import { ensurePdfSegmentSummaries } from '../summary/segments'
import { createBookToolExecutor, type BookCitation } from '../tools/bookTools'

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  /** Visible user text. The model still receives `content`. */
  displayText?: string
  quote?: string
  reasoningContent?: string
  citations?: BookCitation[]
  relatedQuestions?: string[]
  createdAt: number
}

export type PdfChat = {
  id: string
  ownerId: string
  simpleId: string
  title: string
  updatedAt: number
  messages: ChatMessage[]
}

const legacyChatId = (simpleId: string) => `pdf:${simpleId}`

const chatsTable = (storage: DexieStorage) => storage.getAiTable('llmChats')

export const listPdfChats = async (storage: DexieStorage, simpleId: string): Promise<PdfChat[]> => {
  const table = chatsTable(storage)
  if (!table || !simpleId) {
    return []
  }
  const rows = (await table.toArray()) as PdfChat[]
  return rows
    .filter((row) => row.simpleId === simpleId && (row.ownerId ?? '') === ANONYMOUS_OWNER_ID)
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export const loadPdfChat = async (storage: DexieStorage, simpleId: string): Promise<PdfChat | null> => {
  const chats = await listPdfChats(storage, simpleId)
  if (chats.length > 0) {
    return chats[0]
  }
  const table = chatsTable(storage)
  if (!table) {
    return null
  }
  const legacy = (await table.get([ANONYMOUS_OWNER_ID, legacyChatId(simpleId)])) as PdfChat | undefined
  return legacy ?? null
}

export const loadPdfChatById = async (storage: DexieStorage, chatId: string): Promise<PdfChat | null> => {
  const table = chatsTable(storage)
  if (!table || !chatId) {
    return null
  }
  const row = (await table.get([ANONYMOUS_OWNER_ID, chatId])) as PdfChat | undefined
  return row ?? null
}

export const savePdfChat = async (storage: DexieStorage, chat: PdfChat) => {
  const table = chatsTable(storage)
  if (!table) {
    throw new Error('Chat storage is not ready')
  }
  await table.put(toStorageValue({ ...chat, ownerId: ANONYMOUS_OWNER_ID }))
}

export const deletePdfChat = async (storage: DexieStorage, chatId: string) => {
  const table = chatsTable(storage)
  if (!table || !chatId) {
    return
  }
  await table.delete([ANONYMOUS_OWNER_ID, chatId])
}

export const sendPdfChat = async (input: {
  reader: Reader
  storage: DexieStorage
  simpleId: string
  chatId?: string
  text: string
  displayText?: string
  quote?: string
  responseLanguage: string
  askLongTextConsent?: (charCount: number) => Promise<boolean>
  onChunk?: (content: string) => void
  onUpdate?: (patch: { content?: string; reasoningContent?: string }) => void
  onStatus?: (status: string) => void
  onProgress?: (done: number, total: number) => void
  signal?: AbortSignal
}): Promise<PdfChat> => {
  const text = input.text.trim()
  if (!text || !input.simpleId) {
    throw new Error('Message is empty')
  }
  input.onStatus?.('extract')
  const cache = await ensurePdfSegmentSummaries({
    reader: input.reader,
    storage: input.storage,
    simpleId: input.simpleId,
    askLongTextConsent: input.askLongTextConsent,
    onPhase: (phase) => input.onStatus?.(phase),
    onProgress: input.onProgress,
    signal: input.signal,
  })
  let reasoningPrefix = ''
  const tools = cache.status === 'ready'
    ? createBookToolExecutor(cache.segments, (text) => {
        reasoningPrefix = text
        input.onUpdate?.({ reasoningContent: text })
      })
    : null
  const existing = input.chatId
    ? await loadPdfChatById(input.storage, input.chatId)
    : await loadPdfChat(input.storage, input.simpleId)
  const now = Date.now()
  const history = existing?.messages ?? []
  const userMessage: ChatMessage = {
    id: `u-${now}`,
    role: 'user',
    content: text,
    displayText: input.displayText?.trim() || undefined,
    quote: input.quote,
    createdAt: now,
  }
  const llmMessages: LlmMessage[] = [
    {
      role: 'system',
      content: [
        'You are a reading assistant for the open PDF.',
        'When you use get_related_segment_summaries, cite excerpts with the exact [n] tags from the tool output.',
        'When you use get_full_book_segment_summaries, do not invent numeric citations.',
        `Reply in ${input.responseLanguage}.`,
      ].join('\n'),
    },
  ]
  for (const message of history.slice(-12)) {
    llmMessages.push({ role: message.role, content: message.content })
  }
  const quoted = input.quote?.trim()
    ? `Selected passage:\n${input.quote.trim()}\n\nQuestion:\n${text}`
    : text
  llmMessages.push({ role: 'user', content: quoted })

  const llm = getLlm()
  const inuse = await llm.modelProvider.getInuseModel()
  input.onStatus?.('chat')
  const result = await llm.client.complete(
    {
      taskId: `chat-${now}`,
      platformId: inuse.platformId,
      model: inuse.model,
      purpose: 'chat',
      responseLanguage: input.responseLanguage,
      signal: input.signal,
      stream: true,
      tools: tools?.tools,
      messages: llmMessages,
    },
    {
      onChunk: async (event) => {
        if (event.done) {
          return
        }
        if (event.content) {
          input.onChunk?.(event.content)
        }
        input.onUpdate?.({
          ...(event.content != null ? { content: event.content } : {}),
          ...(event.reasoningContent != null ? { reasoningContent: event.reasoningContent } : {}),
        })
      },
      executeToolCall: tools?.executeToolCall,
      getExternalReasoningPrefix: () => reasoningPrefix,
    },
  )
  const cited = new Set<number>()
  const citePattern = /\[(\d+)\]/g
  let citeMatch = citePattern.exec(result.content)
  while (citeMatch) {
    cited.add(Number(citeMatch[1]))
    citeMatch = citePattern.exec(result.content)
  }
  const assistant: ChatMessage = {
    id: `a-${Date.now()}`,
    role: 'assistant',
    content: result.content,
    reasoningContent: result.reasoningContent || reasoningPrefix || undefined,
    citations: tools?.getCitations().filter((item) => cited.has(item.n)),
    createdAt: Date.now(),
  }
  const titleSource = (input.displayText?.trim() || text).replace(/\s+/g, ' ').trim()
  const chat: PdfChat = {
    id: existing?.id || `pdf:${input.simpleId}:${now}`,
    ownerId: ANONYMOUS_OWNER_ID,
    simpleId: input.simpleId,
    title: existing?.title?.trim() || titleSource.slice(0, 42) || 'Chat',
    updatedAt: assistant.createdAt,
    messages: [...history, userMessage, assistant],
  }
  await savePdfChat(input.storage, chat)
  return chat
}
