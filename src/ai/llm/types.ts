export type LlmPurpose = 'chat' | 'summary' | 'translate' | 'explain' | 'lookup' | (string & {})

export type LlmToolCall = {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export type LlmMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: LlmToolCall[]
  tool_call_id?: string
}

export type LlmToolDefinition = {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export type LlmChunkEvent = {
  content?: string
  reasoningContent?: string
  done?: boolean
}

export type LlmCompleteResult = {
  success: boolean
  content: string
  reasoningContent?: string
  tool_calls?: LlmToolCall[]
}

export type LlmCompleteRequest = {
  taskId: string
  platformId: string
  model: string
  messages: LlmMessage[]
  tools?: LlmToolDefinition[]
  purpose?: LlmPurpose
  responseLanguage?: string
  quality?: 'medium' | 'high' | 'low'
  signal?: AbortSignal
  stream?: boolean
  /** When false, chunk callbacks omit answer text. Used while a tool is choosing segments. */
  publishContent?: boolean
}

export type LlmCompleteCallbacks = {
  onChunk?: (event: LlmChunkEvent) => void | Promise<void>
  executeToolCall?: (call: LlmToolCall) => Promise<string>
  getExternalReasoningPrefix?: () => string
}

export type LlmModel = {
  name: string
  title?: string
  isInUse?: boolean
  isOfficial?: boolean
}

export type LlmSetting = {
  id: string
  platform: string
  models: LlmModel[]
  baseUrl: string
  apiKey?: string
  isOfficial?: boolean
}

export const DefaultOfficialPlatformId = 'lhx-auto-platformid'
export const DefaultOfficialModelName = 'lhx-auto-model'
