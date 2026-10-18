import { getRandomId } from '@foxycape/core/kernal/common/uuid'
import { getLlm } from '../llm'
import type { ChatMessage } from './chatService'

export const parseRelatedQuestions = (content: string): string[] => {
  const trimmed = content.trim()
  if (!trimmed) {
    return []
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  const raw = fenced?.[1]?.trim() || trimmed
  const read = (value: unknown): string[] => {
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean).slice(0, 3)
    }
    if (value && typeof value === 'object' && 'questions' in value) {
      return read((value as { questions: unknown }).questions)
    }
    return []
  }
  try {
    return read(JSON.parse(raw) as unknown)
  } catch {
    const objectMatch = raw.match(/\{[\s\S]*\}/)
    if (!objectMatch) {
      return []
    }
    try {
      return read(JSON.parse(objectMatch[0]) as unknown)
    } catch {
      return []
    }
  }
}

export const fetchRelatedQuestions = async (input: {
  messages: ChatMessage[]
  language: string
  signal?: AbortSignal
}): Promise<string[]> => {
  const recent = input.messages.slice(-8)
  if (recent.length === 0) {
    return []
  }
  const llm = getLlm()
  const inuse = await llm.modelProvider.getInuseModel()
  const result = await llm.client.complete({
    taskId: getRandomId(),
    platformId: inuse.platformId,
    model: inuse.model,
    purpose: 'chat',
    responseLanguage: input.language,
    signal: input.signal,
    stream: false,
    messages: [
      {
        role: 'system',
        content: [
          'Generate 1 to 3 follow-up reading questions from the conversation.',
          `Write the questions in ${input.language}.`,
          'Return JSON {"questions":["..."]} only.',
        ].join('\n'),
      },
      {
        role: 'user',
        content: recent.map((item) => `${item.role}: ${item.content}`).join('\n\n'),
      },
    ],
  })
  return parseRelatedQuestions(result.content)
}
