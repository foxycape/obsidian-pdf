import { getRandomId } from '@foxycape/core/kernal/common/uuid'
import { getLlm } from '../llm'
import type { ExplainDetail } from '../passage/types'
import { getAiRuntime } from '../runtime'
import { upsertExplain } from '../passage/stores'
import type { DexieStorage } from '@/storage/DexieStorage'
import type { FixedContentRange } from '@foxycape/core/kernal/ContentRange'

const clip = (text: string) => {
  const trimmed = text.trim()
  return trimmed.length <= 1600 ? trimmed : trimmed.slice(0, 1600)
}

const sentenceLimit = (detail: ExplainDetail) => (detail === 'detailed' ? 10 : 2)

export const normalizeExplainPassage = (content: string, detail: ExplainDetail): string => {
  const lines = content
    .replace(/```[\s\S]*?```/g, ' ')
    .split(/\n+/)
    .map((line) => line.replace(/^\s*(?:[-*]|\d+\.)\s+/, '').trim())
    .filter(Boolean)
  const text = lines.join(' ').replace(/\s+/g, ' ').trim()
  const sentences = text
    .split(/(?<=[。！？.!?])(?:\s+)?/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, sentenceLimit(detail))
  const joiner = sentences.some((item) => /[。！？]$/.test(item)) ? '' : ' '
  return sentences.join(joiner)
}

const systemPrompt = (detail: ExplainDetail) =>
  detail === 'detailed'
    ? 'You unstick a reader on one passage. Answer in 6-10 sentences. Never summarize the whole book.'
    : 'You unstick a reader on one passage. Answer in 1-2 sentences. Never summarize the whole book.'

export const explainPassage = async (input: {
  storage: DexieStorage
  markId: string
  simpleId: string
  text: string
  pageNumber?: number
  responseLanguage: string
  detail: ExplainDetail
  navUrl?: string
  navTitle?: string
  contentRange?: FixedContentRange
  signal?: AbortSignal
}): Promise<string> => {
  const passage = clip(input.text)
  if (!passage || !input.markId) {
    return ''
  }
  const lengthLine =
    input.detail === 'detailed'
      ? `Write 6 to 10 short sentences in ${input.responseLanguage}.`
      : `Write 1 to 2 short sentences in ${input.responseLanguage}.`
  const llm = getLlm()
  const inuse = await llm.modelProvider.getInuseModel()
  const result = await llm.client.complete({
    taskId: getRandomId(),
    platformId: inuse.platformId,
    model: inuse.model,
    purpose: 'explain',
    responseLanguage: input.responseLanguage,
    signal: input.signal,
    stream: false,
    messages: [
      { role: 'system', content: systemPrompt(input.detail) },
      {
        role: 'user',
        content: [
          'Explain this passage so the reader can continue on the same page.',
          lengthLine,
          'Stay inside this excerpt. Do not summarize the rest of the book.',
          'Do not spoil later plot, later chapters, or unseen outcomes.',
          'No headings, lists, or translator notes.',
          '',
          '### Passage',
          passage,
        ].join('\n'),
      },
    ],
  })
  const explanation = normalizeExplainPassage(result.content, input.detail)
  if (!explanation) {
    return ''
  }
  await upsertExplain(input.storage, {
    markId: input.markId,
    simpleId: input.simpleId,
    text: passage,
    pageNumber: input.pageNumber,
    navUrl: input.navUrl,
    navTitle: input.navTitle,
    contentRange: input.contentRange,
    detail: input.detail,
    explanation,
  })
  await getAiRuntime().writePassageNote?.({
    kind: 'explain',
    markId: input.markId,
    simpleId: input.simpleId,
    text: passage,
    body: explanation,
    pageNumber: input.pageNumber,
  })
  return explanation
}
