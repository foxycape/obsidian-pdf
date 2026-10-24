import type { ChatCompletionContentPart } from 'openai/resources'
import type { TokenUsage } from './types'

export type LlmToolCall = {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export type LlmAudioOutput = {
  id: string
  data: string
  expires_at: number
  transcript: string
}

export type LlmUrlCitation = {
  start_index: number
  end_index: number
  title: string
  url: string
}

export type AssistantContentPart = {
  type: 'assistant'
  content?: string | null
  reasoningContent?: string
  tool_calls?: LlmToolCall[]
  audio?: LlmAudioOutput
  annotations?: Array<{ type: 'url_citation'; url_citation: LlmUrlCitation }>
  usage?: TokenUsage
  finishReason?: string
}

export type ToolContentPart = {
  type: 'tool'
  tool_call_id: string
  content: string
  name?: string
}

export type UserContentPart = {
  type: 'user'
  content: string | Array<ChatCompletionContentPart>
  displayInput?: string
}

export type ContentPart = AssistantContentPart | ToolContentPart | UserContentPart
