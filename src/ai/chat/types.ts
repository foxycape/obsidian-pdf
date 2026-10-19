import type { ChatCompletionContentPart } from 'openai/resources'
import type { ContentPart } from '../llm/contentParts'
import type { TokenUsage } from '../llm/types'

export type DocumentCitation = {
  id: string
  simpleId: string
  resourceTitle: string
  url?: string
  fileIndex?: number
  pageNumber?: number
  startTextOffset?: number
  endTextOffset?: number
  snippet?: string
  navPointTitle?: string
}

export type MessageRole = 'developer' | 'system' | 'user' | 'assistant' | 'tool' | 'function'

export type LlmMessageState = 'loading' | 'done' | 'error' | 'generating'

export type LlmMessage = {
  id: string
  chatId: string
  createdAt?: number
  model?: string
  role: MessageRole
  input: string | Array<ChatCompletionContentPart>
  content: string
  reasoningContent?: string
  displayReasoningContent?: boolean
  contents?: ContentPart[]
  inputMessageId?: string
  usage?: TokenUsage
  requestId?: string
  state?: LlmMessageState
  error?: string
  /** Locations of fragments this message actually cites, not the full retrieval set. */
  citations?: DocumentCitation[]
  relatedQuestions?: string[]
}
