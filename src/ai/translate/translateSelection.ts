import { getRandomId } from '@foxycape/core/kernal/common/uuid'
import type { IHttpClient } from '@foxycape/core/kernal/network/IHttpClient'
import { getLlm } from '../llm'
import type { TranslateEngine } from '../passage/types'

const EDGE_URL = 'https://edge.microsoft.com/translate/translatetext?to={to}&isEnterpriseClient=false'

const toLanguage = (code: string) => {
  const normalized = code.trim().toLowerCase()
  if (normalized === 'zh' || normalized === 'zh-cn' || normalized === 'zho') {
    return 'zh-Hans'
  }
  if (normalized === 'zh-tw' || normalized === 'zh-hk') {
    return 'zh-Hant'
  }
  return code.trim() || 'en'
}

const parseEdge = (raw: unknown): string => {
  if (!Array.isArray(raw) || raw.length === 0) {
    return ''
  }
  const first = raw[0] as { translations?: { text?: string }[] }
  return first?.translations?.[0]?.text?.trim() ?? ''
}

export const translateWithEdge = async (
  httpClient: IHttpClient,
  text: string,
  targetLanguage: string,
  signal?: AbortSignal,
): Promise<string> => {
  const source = text.trim()
  if (!source) {
    return ''
  }
  const url = EDGE_URL.replace('{to}', encodeURIComponent(toLanguage(targetLanguage)))
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort)
  try {
    const raw = await httpClient.post(url, [source], {
      requestBodyType: 'raw',
      abortController: controller,
    })
    return parseEdge(raw)
  } finally {
    signal?.removeEventListener('abort', onAbort)
  }
}

const parseAiTranslation = (content: string): string => {
  const trimmed = content.trim()
  try {
    const parsed = JSON.parse(trimmed) as { outputs?: { tgt?: string }[]; tgt?: string }
    if (typeof parsed.tgt === 'string') {
      return parsed.tgt.trim()
    }
    const first = parsed.outputs?.find((item) => typeof item?.tgt === 'string')
    if (first?.tgt) {
      return first.tgt.trim()
    }
  } catch {
    // Models sometimes return plain text.
  }
  return trimmed
}

export const translateWithAi = async (
  text: string,
  targetLanguage: string,
  signal?: AbortSignal,
  quality?: 'low' | 'medium',
): Promise<string> => {
  const source = text.trim()
  if (!source) {
    return ''
  }
  const llm = getLlm()
  const inuse = await llm.modelProvider.getInuseModel()
  const result = await llm.client.complete({
    taskId: getRandomId(),
    platformId: inuse.platformId,
    model: inuse.model,
    purpose: 'translate',
    responseLanguage: targetLanguage,
    quality,
    signal,
    stream: false,
    messages: [
      {
        role: 'system',
        content: `Translate the user text into ${targetLanguage}. Return JSON {"outputs":[{"id":0,"tgt":"..."}]} only.`,
      },
      {
        role: 'user',
        content: JSON.stringify({ outputs: [{ id: 0, src: source }] }),
      },
    ],
  })
  return parseAiTranslation(result.content)
}

export const translateSelection = async (input: {
  httpClient: IHttpClient
  text: string
  engine: TranslateEngine
  targetLanguage: string
  quality?: 'low' | 'medium'
  signal?: AbortSignal
}): Promise<string> => {
  if (input.engine === 'ai') {
    return translateWithAi(input.text, input.targetLanguage, input.signal, input.quality)
  }
  return translateWithEdge(input.httpClient, input.text, input.targetLanguage, input.signal)
}
