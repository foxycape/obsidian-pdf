import { combineUrlSegments } from '@foxycape/core/kernal/common/url'
import OpenAI from 'openai'
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources'
import { OFFICIAL_AI_GENERATE_PATH } from '@/license/constants'
import { AiAccessError } from '../errors'
import { createObsidianAiFetch } from '../fetch'
import { getLicenseAiUser, refreshLicenseAiQuota } from '../licenseSession'
import { getAiRuntime } from '../runtime'
import { LlmModelProvider } from './LlmModelProvider'
import type { ContentPart, LlmToolCall } from './contentParts'
import {
  DefaultOfficialPlatformId,
  type LlmCompleteCallbacks,
  type LlmCompleteRequest,
  type LlmCompleteResult,
  type LlmChunkEvent,
} from './types'

const MAX_TOOL_ROUNDS = 4

const ANSWER_AFTER_SEARCH =
  'The book search for this turn is finished. Reply to the user in prose now. Do not emit tool calls, XML tags, or function syntax.'

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

const visibleAnswerText = (content: string) => displayAnswerText(content).trim()

const toSdkMessages = (messages: ChatCompletionMessageParam[]): ChatCompletionMessageParam[] => messages

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
    const messages: ChatCompletionMessageParam[] = [...request.messages]
    const assistantTrace: ContentPart[] = []
    let tools = request.body?.tools
    let toolTripCount = 0
    let retriedEmptyAnswer = false
    let addedAnswerInstruction = false
    const maxTrips = request.maxToolRoundTrips ?? MAX_TOOL_ROUNDS

    while (true) {
      const answering = toolTripCount > 0
      if (answering) {
        tools = undefined
        if (!addedAnswerInstruction) {
          messages.push({ role: 'system', content: ANSWER_AFTER_SEARCH })
          addedAnswerInstruction = true
        }
      }
      const wantStream = !!callbacks?.onChunk
      const streamReasoningPrefix = callbacks?.getExternalReasoningPrefix?.() ?? ''
      const onChunk = callbacks?.onChunk
        ? async (event: LlmChunkEvent) => {
            const rawContent = event.content
            const content =
              answering && rawContent != null
                ? visibleAnswerText(rawContent).length === 0
                  ? ''
                  : displayAnswerText(rawContent)
                : rawContent
            await callbacks.onChunk?.({
              ...event,
              content,
              reasoningContent: streamReasoningPrefix + (event.reasoningContent ?? ''),
            })
          }
        : undefined
      let result: LlmCompleteResult
      try {
        result = await this.makeRequest(request, messages, tools, wantStream, onChunk)
      } catch (error) {
        if (!wantStream) {
          throw error
        }
        result = await this.makeRequest(request, messages, tools, false, undefined)
      }
      const tailReasoning = result.reasoningContent ?? ''
      const mergedRoundReasoning = streamReasoningPrefix + tailReasoning
      const toolCalls = result.tool_calls
      const hasToolCalls = (toolCalls?.length ?? 0) > 0
      if (answering || !hasToolCalls || !callbacks?.executeToolCall) {
        const prose = answering ? visibleAnswerText(result.content ?? '') : (result.content ?? '')
        if (answering && !prose && !retriedEmptyAnswer) {
          retriedEmptyAnswer = true
          continue
        }
        const content = answering ? prose : (result.content ?? '')
        if (!wantStream && callbacks?.onChunk && content) {
          await callbacks.onChunk({
            content: answering ? displayAnswerText(content) : content,
            reasoningContent: mergedRoundReasoning || undefined,
            done: true,
          })
        }
        assistantTrace.push({
          type: 'assistant',
          content,
          ...(mergedRoundReasoning ? { reasoningContent: mergedRoundReasoning } : {}),
        })
        return {
          ...result,
          content,
          reasoningContent: mergedRoundReasoning || undefined,
          tool_calls: answering ? undefined : toolCalls,
          contents: assistantTrace,
        }
      }
      assistantTrace.push({
        type: 'assistant',
        content: result.content ?? '',
        ...(mergedRoundReasoning ? { reasoningContent: mergedRoundReasoning } : {}),
        ...(toolCalls?.length ? { tool_calls: toolCalls } : {}),
      })
      messages.push({
        role: 'assistant',
        content: result.content || null,
        tool_calls: toolCalls,
      })
      for (const call of toolCalls ?? []) {
        const output = await callbacks.executeToolCall(call)
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: output,
        })
        assistantTrace.push({
          type: 'tool',
          tool_call_id: call.id,
          content: output,
          name: call.function?.name,
        })
      }
      toolTripCount += 1
      if (toolTripCount > maxTrips) {
        throw new Error('Tool round limit reached')
      }
    }
  }

  private makeRequest = async (
    request: LlmCompleteRequest,
    messages: ChatCompletionMessageParam[],
    tools: ChatCompletionTool[] | undefined,
    stream: boolean,
    onChunk?: (event: LlmChunkEvent) => void | Promise<void>,
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
    const toolBuckets = new Map<number, LlmToolCall>()
    const emit = async () => {
      if (!onChunk) {
        return
      }
      await onChunk({
        content,
        ...(reasoning ? { reasoningContent: reasoning } : {}),
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
      if (changed) {
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
    await onChunk?.({ done: true })
    if (isOfficial) {
      await refreshLicenseAiQuota(runtime.apiClient)
    }
    const toolCalls = [...toolBuckets.values()].filter((item) => item.id && item.function.name)
    return {
      success: true,
      content,
      reasoningContent: reasoning || undefined,
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
    }
  }
}
