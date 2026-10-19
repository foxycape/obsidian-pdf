import type { ChatCompletionContentPart, ChatCompletionCreateParams } from 'openai/resources'
import type { ContentPart, LlmToolCall } from './contentParts'

/** Business purpose of this LLM call (chat, summary, explain, …). */
export type LlmPurpose = 'chat' | 'summary' | 'review' | 'translate' | 'explain' | 'lookup' | 'vision' | (string & {})

export type Thinking = {
  type?: 'disabled' | 'enabled' | 'auto'
}

export type CustomChatCompletionCreateParams = ChatCompletionCreateParams & {
  thinking?: Thinking | null
  enable_search?: boolean
  enable_thinking?: boolean
  text?: { format?: unknown }
}

export type TokenUsage = {
  total_tokens?: number
  prompt_tokens?: number
  completion_tokens?: number
  prompt_tokens_details?: PromptTokensDetails
}

export type PromptTokensDetails = {
  cached_tokens?: number
}

export type LlmChunkEvent = {
  chunk?: unknown
  content?: string
  reasoningContent?: string
  taskId?: string
  done?: boolean
  finishReason?: string
  tool_calls?: LlmToolCall[]
}

export type LlmCompleteResult = {
  success: boolean
  content: string
  reasoningContent?: string
  usage?: TokenUsage
  requestId?: string
  responseCode?: number
  finishReason?: string
  tool_calls?: LlmToolCall[]
  contents?: ContentPart[]
}

export type LlmCompleteRequest = {
  taskId: string
  platformId: string
  model: string
  /** Caller-built conversation including system / history / user. */
  messages: ChatCompletionCreateParams['messages']
  body?: Omit<CustomChatCompletionCreateParams, 'messages' | 'model'>
  maxToolRoundTrips?: number
  /** Official proxy `language` header. Must be a BCP-47 language code, not a display name. */
  responseLanguage?: string
  quality?: 'medium' | 'high' | 'low'
  /** Business purpose of this call. Sent as header `purpose`. */
  purpose?: LlmPurpose
  signal?: AbortSignal
}

export type LlmCompleteCallbacks = {
  onChunk?: (event: LlmChunkEvent) => void | Promise<void>
  executeToolCall?: (call: LlmToolCall) => Promise<string>
  getExternalReasoningPrefix?: () => string
}

export type LlmSetting = {
  id: string
  platform: string
  models: LlmModel[]
  baseUrl: string
  apiKey?: string
  isOfficial?: boolean
  preferModels?: string[]
  providerWebsite?: string
}

export type LlmModel = {
  name: string
  title?: string
  isInUse?: boolean
  maxInput?: number
  maxOutput?: number
  supportReasoning?: boolean
  supportJson?: boolean
  supportMultimodal?: boolean
  isOfficial?: boolean
  preferSummary?: boolean
  supportLongContext?: boolean
}

export type ResolveModelInput = string | Array<ChatCompletionContentPart>

export const DefaultOfficialPlatformId = 'lhx-auto-platformid'
export const DefaultOfficialModelName = 'lhx-auto-model'
