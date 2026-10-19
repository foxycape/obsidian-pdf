import { getRandomId } from '@foxycape/core/kernal/common/uuid'
import type { DexieStorage } from '@/storage/DexieStorage'
import type { FixedContentRange } from '@foxycape/core/kernal/ContentRange'
import { getLlm } from '../llm'
import { upsertLookup } from '../passage/stores'
import type { ExplainDetail } from '../passage/types'
import { getAiRuntime } from '../runtime'

const clip = (text: string) => {
  const trimmed = text.trim()
  return trimmed.length <= 1600 ? trimmed : trimmed.slice(0, 1600)
}

const sentenceLimit = (detail: ExplainDetail) => (detail === 'detailed' ? 10 : 2)

const normalizeLookup = (content: string, detail: ExplainDetail): string => {
  const text = content.replace(/\s+/g, ' ').trim()
  const sentences = text
    .split(/(?<=[。！？.!?])(?:\s+)?/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, sentenceLimit(detail))
  const joiner = sentences.some((item) => /[。！？]$/.test(item)) ? '' : ' '
  return sentences.join(joiner)
}

export const lookupWord = async (input: {
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
    purpose: 'lookup',
    responseLanguage: input.responseLanguage,
    signal: input.signal,
    messages: [
      {
        role: 'system',
        content:
          'You define a word or short passage in context. Put pronunciation in the same sentence as the meaning. Use IPA, pinyin, or kana for the source language. Do not invent a pronunciation. Never summarize the whole book.',
      },
      {
        role: 'user',
        content: [
          'Look up this selection so the reader can continue.',
          lengthLine,
          'For a word or short phrase, show how that word is pronounced, then the sense that fits this passage.',
          'For a sentence, give the sentence meaning, then the pronunciation and meaning of any hard words.',
          'No headings or lists.',
          '',
          '### Passage',
          passage,
        ].join('\n'),
      },
    ],
  })
  const lookup = normalizeLookup(result.content, input.detail)
  if (!lookup) {
    return ''
  }
  await upsertLookup(input.storage, {
    markId: input.markId,
    simpleId: input.simpleId,
    text: passage,
    pageNumber: input.pageNumber,
    navUrl: input.navUrl,
    navTitle: input.navTitle,
    contentRange: input.contentRange,
    detail: input.detail,
    lookup,
  })
  try {
    await getAiRuntime().writePassageNote?.({
      kind: 'lookup',
      markId: input.markId,
      simpleId: input.simpleId,
      text: passage,
      body: lookup,
      pageNumber: input.pageNumber,
    })
  } catch (error) {
    console.error('[Foxycape PDF] failed to write passage note', error)
  }
  return lookup
}
