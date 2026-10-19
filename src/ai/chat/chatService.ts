import type { Reader } from '@foxycape/core/kernal'
import type { ChatCompletionMessageParam } from 'openai/resources'
import { ANONYMOUS_OWNER_ID } from '@/storage/ownerId'
import type { DexieStorage } from '@/storage/DexieStorage'
import { toStorageValue } from '@/storage/toStorageValue'
import { getLlm } from '../llm'
import type { UserContentPart } from '../llm/contentParts'
import { ensurePdfSegmentSummaries } from '../summary/segments'
import { createBookToolExecutor } from '../tools/bookTools'
import type { DocumentCitation, LlmMessage } from './types'

export type ChatMessage = LlmMessage & {
  quote?: string
}

type LegacyCitation = {
  n?: number
  id?: string
  pageNumber?: number
  title?: string
  excerpt?: string
  snippet?: string
  startOffset?: number
  endOffset?: number
  startTextOffset?: number
  endTextOffset?: number
  simpleId?: string
  resourceTitle?: string
  navPointTitle?: string
}

const displayInputOf = (message: { contents?: LlmMessage['contents']; displayText?: string }) => {
  const part = message.contents?.find((item): item is UserContentPart => item.type === 'user')
  if (part?.displayInput?.trim()) {
    return part.displayInput.trim()
  }
  return message.displayText?.trim() || ''
}

export const messageDisplayInput = (message: ChatMessage) => displayInputOf(message)

const TITLE_MAX_CHARS = 40

const fallbackTitle = (text: string) => {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  if (!trimmed) {
    return 'Chat'
  }
  return trimmed.length > TITLE_MAX_CHARS ? `${trimmed.slice(0, TITLE_MAX_CHARS)}…` : trimmed
}

const cleanOptional = (value?: string) => {
  const trimmed = value?.trim()
  return trimmed || undefined
}

const toCitation = (raw: LegacyCitation, simpleId: string): DocumentCitation => ({
  id: raw.id || String(raw.n ?? ''),
  simpleId: raw.simpleId || simpleId,
  resourceTitle: raw.resourceTitle || '',
  pageNumber: raw.pageNumber,
  snippet: raw.snippet || raw.excerpt,
  navPointTitle: raw.navPointTitle || raw.title,
  startTextOffset: raw.startTextOffset ?? raw.startOffset,
  endTextOffset: raw.endTextOffset ?? raw.endOffset,
})

export const normalizeChatMessage = (raw: ChatMessage & { displayText?: string }, simpleId: string): ChatMessage => {
  const content = raw.content || ''
  const displayInput = displayInputOf(raw)
  const role = raw.role === 'assistant' ? 'assistant' : 'user'
  const contents = raw.contents?.length
    ? raw.contents
    : displayInput
      ? [{ type: 'user' as const, content, displayInput }]
      : undefined
  return {
    ...raw,
    id: raw.id,
    chatId: raw.chatId || '',
    role,
    input: raw.input ?? content,
    content,
    quote: raw.quote,
    reasoningContent: raw.reasoningContent,
    contents,
    citations: raw.citations?.map((item) => toCitation(item, simpleId)).filter((item) => item.id),
    relatedQuestions: raw.relatedQuestions,
    createdAt: raw.createdAt,
    state: raw.state ?? 'done',
  }
}

export type PdfChatSource = {
  pdfTitle?: string
  filePath?: string
  sourceUrl?: string
}

export type PdfChat = {
  id: string
  ownerId: string
  simpleId: string
  pdfTitle?: string
  /** Vault path of the PDF this chat belongs to. */
  filePath?: string
  /** Remote PDF address when the document is not a vault file. */
  sourceUrl?: string
  title: string
  /** Set after a model-generated title is saved, so later replies do not replace it. */
  titleIsModified?: boolean
  updatedAt: number
  messages: ChatMessage[]
}

const legacyChatId = (simpleId: string) => `pdf:${simpleId}`

const chatsTable = (storage: DexieStorage) => storage.getAiTable('llmChats')

export const listPdfChats = async (storage: DexieStorage, simpleId?: string): Promise<PdfChat[]> => {
  const table = chatsTable(storage)
  if (!table) {
    return []
  }
  const rows = (await table.toArray()) as PdfChat[]
  return rows
    .filter((row) => (row.ownerId ?? '') === ANONYMOUS_OWNER_ID && (!simpleId || row.simpleId === simpleId))
    .map((row) => ({
      ...row,
      messages: (row.messages ?? []).map((message) => normalizeChatMessage(message, row.simpleId || simpleId || '')),
    }))
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
  if (!legacy) {
    return null
  }
  return {
    ...legacy,
    messages: (legacy.messages ?? []).map((message) => normalizeChatMessage(message, simpleId)),
  }
}

export const loadPdfChatById = async (storage: DexieStorage, chatId: string): Promise<PdfChat | null> => {
  const table = chatsTable(storage)
  if (!table || !chatId) {
    return null
  }
  const row = (await table.get([ANONYMOUS_OWNER_ID, chatId])) as PdfChat | undefined
  if (!row) {
    return null
  }
  return {
    ...row,
    messages: (row.messages ?? []).map((message) => normalizeChatMessage(message, row.simpleId)),
  }
}

export const savePdfChat = async (storage: DexieStorage, chat: PdfChat) => {
  const table = chatsTable(storage)
  if (!table) {
    throw new Error('Chat storage is not ready')
  }
  await table.put(toStorageValue({ ...chat, ownerId: ANONYMOUS_OWNER_ID }))
}

export const createEmptyPdfChat = async (
  storage: DexieStorage,
  simpleId: string,
  source?: PdfChatSource,
): Promise<PdfChat> => {
  const now = Date.now()
  const chat: PdfChat = {
    id: `pdf:${simpleId}:${now}`,
    ownerId: ANONYMOUS_OWNER_ID,
    simpleId,
    title: '',
    pdfTitle: cleanOptional(source?.pdfTitle),
    filePath: cleanOptional(source?.filePath),
    sourceUrl: cleanOptional(source?.sourceUrl),
    updatedAt: now,
    messages: [],
  }
  await savePdfChat(storage, chat)
  return chat
}

/** Fill a missing vault path or remote address on chats for this document. Existing paths stay. */
export const rememberPdfSource = async (
  storage: DexieStorage,
  simpleId: string,
  source: PdfChatSource,
) => {
  const filePath = cleanOptional(source.filePath)
  const sourceUrl = cleanOptional(source.sourceUrl)
  const pdfTitle = cleanOptional(source.pdfTitle)
  if (!simpleId || (!filePath && !sourceUrl && !pdfTitle)) {
    return
  }
  const chats = await listPdfChats(storage, simpleId)
  for (const chat of chats) {
    const nextFilePath = cleanOptional(chat.filePath) || filePath
    const nextSourceUrl = cleanOptional(chat.sourceUrl) || sourceUrl
    const nextPdfTitle = cleanOptional(chat.pdfTitle) || pdfTitle
    if (
      nextFilePath === cleanOptional(chat.filePath) &&
      nextSourceUrl === cleanOptional(chat.sourceUrl) &&
      nextPdfTitle === cleanOptional(chat.pdfTitle)
    ) {
      continue
    }
    await savePdfChat(storage, {
      ...chat,
      filePath: nextFilePath,
      sourceUrl: nextSourceUrl,
      pdfTitle: nextPdfTitle,
    })
  }
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
  displayInput?: string
  quote?: string
  pdfTitle?: string
  filePath?: string
  sourceUrl?: string
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
    ? createBookToolExecutor(cache.segments, input.simpleId, (text) => {
        reasoningPrefix = text
        input.onUpdate?.({ reasoningContent: text })
      })
    : null
  const now = Date.now()
  const existing = input.chatId ? await loadPdfChatById(input.storage, input.chatId) : null
  const chatId = existing?.id || input.chatId || `pdf:${input.simpleId}:${now}`
  const history = existing?.messages ?? []
  const displayInput = input.displayInput?.trim() || ''
  const userMessage: ChatMessage = {
    id: `u-${now}`,
    chatId,
    role: 'user',
    input: text,
    content: text,
    contents: displayInput ? [{ type: 'user', content: text, displayInput }] : undefined,
    quote: input.quote,
    createdAt: now,
    state: 'done',
  }
  const llmMessages: ChatCompletionMessageParam[] = [
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
    if (message.role !== 'user' && message.role !== 'assistant') {
      continue
    }
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
      body: tools?.tools?.length ? { tools: tools.tools } : undefined,
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
          ...(event.reasoningContent ? { reasoningContent: event.reasoningContent } : {}),
        })
      },
      executeToolCall: tools?.executeToolCall,
      getExternalReasoningPrefix: () => reasoningPrefix,
    },
  )
  const cited = new Set<string>()
  const citePattern = /\[(\d+)\]/g
  let citeMatch = citePattern.exec(result.content)
  while (citeMatch) {
    cited.add(citeMatch[1] ?? '')
    citeMatch = citePattern.exec(result.content)
  }
  const assistant: ChatMessage = {
    id: `a-${Date.now()}`,
    chatId,
    role: 'assistant',
    input: '',
    content: result.content,
    reasoningContent: result.reasoningContent || reasoningPrefix || undefined,
    contents: result.contents,
    citations: tools?.getCitations().filter((item) => cited.has(item.id)),
    createdAt: Date.now(),
    state: 'done',
  }
  const titleSource = (displayInput || text).replace(/\s+/g, ' ').trim()
  const titleIsModified = existing?.titleIsModified === true
  const chat: PdfChat = {
    id: chatId,
    ownerId: ANONYMOUS_OWNER_ID,
    simpleId: input.simpleId,
    title: titleIsModified
      ? existing?.title?.trim() || fallbackTitle(titleSource)
      : fallbackTitle(titleSource || existing?.title || ''),
    titleIsModified: titleIsModified || undefined,
    pdfTitle: cleanOptional(existing?.pdfTitle) || cleanOptional(input.pdfTitle),
    filePath: cleanOptional(existing?.filePath) || cleanOptional(input.filePath),
    sourceUrl: cleanOptional(existing?.sourceUrl) || cleanOptional(input.sourceUrl),
    updatedAt: assistant.createdAt,
    messages: [...history, userMessage, assistant],
  }
  await savePdfChat(input.storage, chat)
  if (titleIsModified || !assistant.content.trim()) {
    return chat
  }
  return tryAutoUpdateTitle(input.storage, chat, input.signal)
}

const titleHistory = (messages: ChatMessage[]) =>
  messages
    .filter((item) => item.role === 'user' || item.role === 'assistant')
    .slice(-6)
    .map((item) => {
      const text = item.role === 'user' ? messageDisplayInput(item) || item.content : item.content
      return `${item.role}: ${text}`
    })
    .join('\n')

const tryAutoUpdateTitle = async (
  storage: DexieStorage,
  chat: PdfChat,
  signal?: AbortSignal,
): Promise<PdfChat> => {
  if (chat.titleIsModified) {
    return chat
  }
  try {
    const llm = getLlm()
    const inuse = await llm.modelProvider.getInuseModel()
    const result = await llm.client.complete({
      taskId: `title-${chat.id}-${Date.now()}`,
      platformId: inuse.platformId,
      model: inuse.model,
      purpose: 'chat',
      signal,
      body: { stream: false },
      messages: [
        {
          role: 'system',
          content: 'Generate a short chat title. Reply with the title only. Use the same language as the conversation.',
        },
        {
          role: 'user',
          content: `${titleHistory(chat.messages)}\n\nWrite a title within ${TITLE_MAX_CHARS} characters.`,
        },
      ],
    })
    const title = result.content?.replace(/\s+/g, ' ').trim()
    if (!result.success || !title) {
      return chat
    }
    const latest = await loadPdfChatById(storage, chat.id)
    if (!latest || latest.titleIsModified) {
      return latest ?? chat
    }
    const next: PdfChat = {
      ...latest,
      title: title.slice(0, TITLE_MAX_CHARS),
      titleIsModified: true,
    }
    await savePdfChat(storage, next)
    return next
  } catch {
    return chat
  }
}
