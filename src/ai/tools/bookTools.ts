import type { ChatCompletionTool } from 'openai/resources'
import type { LlmToolCall } from '../llm'
import type { DocumentCitation } from '../chat/types'
import { getLlm } from '../llm'
import type { PdfSegment } from '../summary/segments'

export const RELATED_SEGMENT_TOOL = 'get_related_segment_summaries'
export const FULL_BOOK_SEGMENT_TOOL = 'get_full_book_segment_summaries'

export const bookChatTools: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: RELATED_SEGMENT_TOOL,
      description:
        'Search segments likely relevant to a specific user question, then return original excerpts. Each excerpt is tagged with [n]. Copy that exact n when citing. Do not use for whole-book summary tasks.',
      parameters: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'Retrieval text for this PDF. Rephrase the user intent into terms the book would use.',
          },
        },
        required: ['question'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: FULL_BOOK_SEGMENT_TOOL,
      description:
        'Load all segment summaries for the current PDF in reading order. These summaries have no citation tags. Use this for whole-book summary or review questions.',
      parameters: { type: 'object', properties: {} },
    },
  },
]

export type BookCitation = DocumentCitation

const pagesOf = (segment: PdfSegment) => {
  if (segment.pages?.length) {
    return segment.pages
  }
  const lines = segment.text.split('\n').filter((line) => line.trim())
  return lines.map((text, index) => ({
    pageNumber: Math.min(segment.endPage, segment.startPage + index),
    text,
  }))
}

const splitSentences = (text: string) => {
  const pieces: { text: string; start: number; end: number }[] = []
  const pattern = /[^。！？.!?\n]+[。！？.!?]?/g
  let match = pattern.exec(text)
  while (match) {
    const raw = match[0]
    const index = match.index
    match = pattern.exec(text)
    if (!raw.trim()) {
      continue
    }
    const previous = pieces[pieces.length - 1]
    if (previous && previous.text.trim().length < 10) {
      previous.text += raw
      previous.end = index + raw.length
      continue
    }
    pieces.push({ text: raw, start: index, end: index + raw.length })
  }
  return pieces.filter((item) => item.text.trim())
}

const parseIds = (raw: string): string[] => {
  try {
    const parsed = JSON.parse(raw) as { answer?: unknown }
    if (!Array.isArray(parsed.answer)) {
      return []
    }
    return parsed.answer.filter((item): item is string => typeof item === 'string').slice(0, 5)
  } catch {
    return []
  }
}

const selectRelated = async (
  segments: PdfSegment[],
  question: string,
  onReasoning?: (text: string) => void,
): Promise<PdfSegment[]> => {
  if (segments.length === 0) {
    return []
  }
  const llm = getLlm()
  const inuse = await llm.modelProvider.getInuseModel()
  const documents = JSON.stringify(
    segments.map((segment) => ({
      id: segment.id,
      title: segment.title,
      summary: segment.summary.slice(0, 1500),
    })),
  )
  const result = await llm.client.complete(
    {
      taskId: `related-${Date.now()}`,
      platformId: inuse.platformId,
      model: inuse.model,
      purpose: 'summary',
      messages: [
        {
          role: 'system',
          content: [
            'Select documents that may answer the user query.',
            `Documents: ${documents}`,
            'Return JSON {"answer":["id"]} with at most 5 ids. Use [] if none match.',
          ].join('\n'),
        },
        { role: 'user', content: question },
      ],
    },
    {
      onChunk: (event) => {
        if (event.reasoningContent) {
          onReasoning?.(event.reasoningContent)
        }
      },
    },
  )
  const ids = new Set(parseIds(result.content))
  if (ids.size === 0) {
    return segments.slice(0, Math.min(3, segments.length))
  }
  return segments.filter((segment) => ids.has(segment.id))
}

export const createBookToolExecutor = (
  segments: PdfSegment[],
  simpleId: string,
  onReasoning?: (text: string) => void,
) => {
  const citations: BookCitation[] = []
  const ready = segments.filter((segment) => segment.summary.trim() && segment.text.trim())

  const related = async (call: LlmToolCall) => {
    let question = ''
    try {
      const args = JSON.parse(call.function.arguments || '{}') as { question?: string; query?: string }
      question = (args.question || args.query || '').trim()
    } catch {
      return '(Tool error: invalid JSON arguments.)'
    }
    if (!question) {
      return '(No question provided for segment lookup.)'
    }
    if (ready.length === 0) {
      return '(No segment summaries are available for this PDF.)'
    }
    const picked = await selectRelated(ready, question, onReasoning)
    if (picked.length === 0) {
      return '(No relevant segment excerpts found for this question.)'
    }
    return picked
      .map((segment) => {
        const lines: string[] = []
        for (const page of pagesOf(segment)) {
          for (const sentence of splitSentences(page.text)) {
            const excerpt = sentence.text.replace(/\s+/g, ' ').trim()
            if (!excerpt) {
              continue
            }
            const n = citations.length + 1
            citations.push({
              id: String(n),
              simpleId,
              resourceTitle: '',
              pageNumber: page.pageNumber,
              navPointTitle: segment.title,
              snippet: excerpt,
              startTextOffset: sentence.start,
              endTextOffset: sentence.end,
            })
            lines.push(`${excerpt}[${n}]`)
          }
        }
        return lines.join('\n')
      })
      .filter((block) => block.length > 0)
      .join('\n\n')
  }

  const full = () => {
    if (ready.length === 0) {
      return '(No full-book segment summaries available.)'
    }
    return ready.map((segment) => `${segment.title}: ${segment.summary}`).join('\n')
  }

  return {
    tools: bookChatTools,
    getCitations: () => citations.slice(),
    executeToolCall: async (call: LlmToolCall) => {
      if (call.function.name === FULL_BOOK_SEGMENT_TOOL) {
        return full()
      }
      if (call.function.name === RELATED_SEGMENT_TOOL) {
        return related(call)
      }
      return `Unsupported tool: ${call.function.name}`
    },
  }
}
