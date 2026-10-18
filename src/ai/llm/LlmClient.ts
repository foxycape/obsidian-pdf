import { combineUrlSegments } from '@foxycape/core/kernal/common/url'
import OpenAI from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources'
import { OFFICIAL_AI_GENERATE_PATH } from '@/license/constants'
import { AiAccessError } from '../errors'
import { createObsidianAiFetch } from '../fetch'
import { getLicenseAiUser, refreshLicenseAiQuota } from '../licenseSession'
import { getAiRuntime } from '../runtime'
import { LlmModelProvider } from './LlmModelProvider'
import {
  DefaultOfficialPlatformId,
  type LlmCompleteCallbacks,
  type LlmCompleteRequest,
  type LlmCompleteResult,
  type LlmMessage,
  type LlmToolCall,
} from './types'

const MAX_TOOL_ROUNDS = 4

const TOOL_CALL_OPEN = '<tool_call>'

const cutTrailingToolOpen = (text: string) => {
  const lower = text.toLowerCase()
  const minPrefix = '<tool'.length
  for (let size = TOOL_CALL_OPEN.length - 1; size >= minPrefix; size -= 1) {
    if (lower.endsWith(TOOL_CALL_OPEN.slice(0, size))) {
      return text.slice(0, -size)
    }
  }
  return text
}

const displayAnswerText = (content: string) => {
  const withoutClosed = content.replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '')
  const withoutTail = withoutClosed.replace(/<tool_call[\s\S]*$/i, '')
  return cutTrailingToolOpen(withoutTail)
}

const toSdkMessages = (messages: LlmMessage[]): ChatCompletionMessageParam[] =>
  messages as ChatCompletionMessageParam[]

const readToolCalls = (raw: unknown): LlmToolCall[] | undefined => {
  if (!Array.isArray(raw) || raw.length === 0) {
    return undefined
  }
  const calls: LlmToolCall[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      continue
    }
    const record = item as Record<string, unknown>
    const id = typeof record.id === 'string' ? record.id : ''
    const fn = record.function as Record<string, unknown> | undefined
    const name = typeof fn?.name === 'string' ? fn.name : ''
    if (!id || !name) {
      continue
    }
    calls.push({
      id,
      type: 'function',
      function: {
        name,
        arguments: typeof fn?.arguments === 'string' ? fn.arguments : '{}',
      },
    })
  }
  return calls.length > 0 ? calls : undefined
}

export class LlmClient {
  constructor(private readonly modelProvider: LlmModelProvider) {}

  complete = async (
    request: LlmCompleteRequest,
    callbacks?: LlmCompleteCallbacks,
  ): Promise<LlmCompleteResult> => {
    const messages = [...request.messages]
    let round = 0
    let answering = false
    while (round <= MAX_TOOL_ROUNDS) {
      const allowTools =
        !!request.tools?.length && !!callbacks?.executeToolCall && round < MAX_TOOL_ROUNDS && !answering
      const publishContent = request.publishContent !== false
      const wantStream = request.stream !== false && !!callbacks?.onChunk
      let result: LlmCompleteResult
      try {
        result = await this.makeRequest(
          request,
          messages,
          allowTools ? request.tools : undefined,
          wantStream,
          publishContent,
          callbacks,
        )
      } catch (error) {
        if (!wantStream) {
          throw error
        }
        result = await this.makeRequest(
          request,
          messages,
          allowTools ? request.tools : undefined,
          false,
          publishContent,
          callbacks,
        )
      }
      const toolCalls = result.tool_calls
      if (!allowTools || !toolCalls?.length || !callbacks?.executeToolCall) {
        if (!wantStream && publishContent && callbacks?.onChunk && result.content) {
          await callbacks.onChunk({
            content: displayAnswerText(result.content),
            reasoningContent: result.reasoningContent,
            done: true,
          })
        }
        return {
          ...result,
          content: publishContent ? displayAnswerText(result.content) : result.content,
        }
      }
      messages.push({
        role: 'assistant',
        content: result.content || null,
        tool_calls: toolCalls,
      })
      for (const call of toolCalls) {
        const output = await callbacks.executeToolCall(call)
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: output,
        })
      }
      answering = true
      round += 1
    }
    throw new Error('Tool round limit reached')
  }

  private makeRequest = async (
    request: LlmCompleteRequest,
    messages: LlmMessage[],
    tools: LlmCompleteRequest['tools'],
    stream: boolean,
    publishContent: boolean,
    callbacks?: LlmCompleteCallbacks,
  ): Promise<LlmCompleteResult> => {
    const runtime = getAiRuntime()
    const settings = await this.modelProvider.getSettings()
    const setting = settings.find((item) => item.id === request.platformId)
    const isOfficial =
      !setting || !!setting.isOfficial || request.platformId === DefaultOfficialPlatformId
    let apiKey = setting?.apiKey ?? ''
    let baseURL = setting?.baseUrl ?? ''
    if (isOfficial) {
      const user = await getLicenseAiUser(runtime.apiClient, runtime.getLicense())
      if (!user?.accessToken) {
        runtime.onNeedLicense()
        throw new AiAccessError('license-required', 'A license is required for official AI')
      }
      if (user.availableAITokenCount === 0) {
        runtime.onQuotaExhausted()
        throw new AiAccessError('no-ai-token', 'Official AI quota used up')
      }
      apiKey = user.accessToken
      baseURL = combineUrlSegments(runtime.apiClient.apiSettings.endPoint, OFFICIAL_AI_GENERATE_PATH)
    } else if (!apiKey.trim() || !baseURL.trim()) {
      throw new AiAccessError('no-ai-provider', 'Custom AI platform is missing a base URL or API key')
    }

    const openai = new OpenAI({
      apiKey,
      baseURL,
      dangerouslyAllowBrowser: true,
      fetch: runtime.fetchImpl ?? createObsidianAiFetch(),
      maxRetries: 1,
    })
    const headers = {
      x_public_appId: runtime.apiClient.apiSettings.appId ?? '20',
      x_public_appVersion: runtime.apiClient.apiSettings.appVersion ?? '1.0.0',
      platformId: request.platformId,
      camelcase: 'true',
      purpose: request.purpose ?? 'chat',
      language: request.responseLanguage ?? '',
      quality: request.quality ?? '',
    }
    const body = {
      model: request.model,
      messages: toSdkMessages(messages),
      stream,
      ...(tools?.length ? { tools } : {}),
    }
    const extra = { headers, signal: request.signal }

    if (!stream) {
      const completion = await openai.chat.completions.create(
        { ...body, stream: false },
        extra,
      )
      const choice = completion.choices[0]
      const message = choice?.message as { content?: string | null; reasoning_content?: string; reasoning?: string } | undefined
      if (isOfficial) {
        await refreshLicenseAiQuota(runtime.apiClient)
      }
      const reasoningContent = message?.reasoning_content || message?.reasoning || undefined
      return {
        success: true,
        content: message?.content ?? '',
        reasoningContent,
        tool_calls: readToolCalls(choice?.message?.tool_calls),
      }
    }

    const completion = await openai.chat.completions.create(
      { ...body, stream: true },
      extra,
    )
    let content = ''
    let reasoning = ''
    const prefix = callbacks?.getExternalReasoningPrefix?.() ?? ''
    const toolBuckets = new Map<number, LlmToolCall>()
    const emit = async () => {
      if (!callbacks?.onChunk) {
        return
      }
      const visibleReasoning = `${prefix}${reasoning}`.trim()
      await callbacks.onChunk({
        ...(publishContent ? { content: displayAnswerText(content) } : {}),
        ...(visibleReasoning ? { reasoningContent: `${prefix}${reasoning}` } : {}),
        done: false,
      })
    }
    for await (const chunk of completion) {
      if (request.signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }
      const delta = chunk.choices[0]?.delta as {
        content?: string
        reasoning_content?: string
        reasoning?: string
        tool_calls?: {
          index?: number
          id?: string
          function?: { name?: string; arguments?: string }
        }[]
      } | undefined
      let changed = false
      if (delta?.content) {
        content += delta.content
        changed = true
      }
      const reasoningDelta = delta?.reasoning_content || delta?.reasoning
      if (reasoningDelta) {
        reasoning += reasoningDelta
        changed = true
      }
      if (changed && (publishContent || reasoning)) {
        await emit()
      }
      const deltas = delta?.tool_calls
      if (Array.isArray(deltas)) {
        for (const item of deltas) {
          const index = item.index ?? 0
          const current = toolBuckets.get(index) ?? {
            id: '',
            type: 'function' as const,
            function: { name: '', arguments: '' },
          }
          if (item.id) {
            current.id = item.id
          }
          if (item.function?.name) {
            current.function.name += item.function.name
          }
          if (item.function?.arguments) {
            current.function.arguments += item.function.arguments
          }
          toolBuckets.set(index, current)
        }
      }
    }
    await callbacks?.onChunk?.({ done: true })
    if (isOfficial) {
      await refreshLicenseAiQuota(runtime.apiClient)
    }
    const toolCalls = [...toolBuckets.values()].filter((item) => item.id && item.function.name)
    return {
      success: true,
      content,
      reasoningContent: reasoning ? `${prefix}${reasoning}` : prefix || undefined,
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
    }
  }
}
