import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { App, TFile } from 'obsidian'
import type { FixedContentRange } from '@foxycape/core/kernal/ContentRange'
import { sharedPassageMarkId } from '@/mark/positionMarkId'
import { DEFAULT_PDF_VIEW_PREFERENCES } from '@/reader/mediaTypes/pdf/CustomPdfOptions'
import { buildAiNoteAppendBlock } from '@/ai/notes/appendAiNote'
import { resolveSidecarNotePath } from '@/obsidian/markNoteSync'
import { bindAiRuntime } from '@/ai/runtime'
import {
  DefaultOfficialModelName,
  DefaultOfficialPlatformId,
  getLlm,
  resetLlm,
} from '@/ai/llm'
import { DexieStorage } from '@/storage/DexieStorage'
import { upsertExplain, upsertLookup, upsertTranslate, listExplainMarks, listLookupMarks, listTranslateMarks } from '@/ai/passage/stores'
import { OFFICIAL_AI_GENERATE_PATH } from '@/license/constants'
import type { IApiClient } from '@/network'

const range = {
  kind: 'fixed',
  geometries: [{ pageNumber: 3, coords: [1, 2, 3, 4] }],
} as unknown as FixedContentRange

describe('shared passage markId', () => {
  it('uses one id for highlight, translate, explain, and lookup of the same passage', () => {
    const text = '  the same passage  '
    const highlight = sharedPassageMarkId('doc-1', range, text)
    const translate = sharedPassageMarkId('doc-1', range, text.trim())
    const explain = sharedPassageMarkId('doc-1', range, 'the same passage')
    const lookup = sharedPassageMarkId('doc-1', range, text)
    expect(highlight).toBe(translate)
    expect(explain).toBe(lookup)
    expect(highlight).toBe(explain)
  })

  it('keeps a different passage on another page distinct', () => {
    const other = {
      kind: 'fixed',
      geometries: [{ pageNumber: 4, coords: [1, 2, 3, 4] }],
    } as unknown as FixedContentRange
    expect(sharedPassageMarkId('doc-1', range, 'same words')).not.toBe(
      sharedPassageMarkId('doc-1', other, 'same words'),
    )
  })
})

describe('markdown note settings', () => {
  it('keeps explain and lookup out of markdown unless enabled', () => {
    expect(DEFAULT_PDF_VIEW_PREFERENCES.writeExplainToMarkdown).toBe(false)
    expect(DEFAULT_PDF_VIEW_PREFERENCES.writeLookupToMarkdown).toBe(false)
    expect(DEFAULT_PDF_VIEW_PREFERENCES.writeTranslateToMarkdown).toBe(false)
  })

  it('appends explain and lookup into the same PDF markdown file', () => {
    const pdfFile = { path: 'Notes/Book.pdf', basename: 'Book', parent: { path: 'Notes' } } as TFile
    expect(resolveSidecarNotePath(pdfFile)).toBe('Notes/Book.md')
    const app = {
      fileManager: {
        generateMarkdownLink: (_file: TFile, _from: string, subpath: string, alias: string) =>
          `[[Book.pdf${subpath}|${alias}]]`,
      },
    } as unknown as App
    const noteFile = { path: 'Notes/Book.md' } as TFile
    const explain = buildAiNoteAppendBlock(app, { pdfFile }, noteFile, {
      kind: 'explain',
      markId: 'same-id',
      text: 'passage',
      body: 'because',
      pageNumber: 3,
    })
    const lookup = buildAiNoteAppendBlock(app, { pdfFile }, noteFile, {
      kind: 'lookup',
      markId: 'same-id',
      text: 'passage',
      body: 'means',
      pageNumber: 3,
    })
    const translation = buildAiNoteAppendBlock(app, { pdfFile }, noteFile, {
      kind: 'translate',
      markId: 'same-id',
      text: 'passage',
      body: '译文',
      pageNumber: 3,
    })
    expect(explain).toContain('markId=same-id')
    expect(lookup).toContain('markId=same-id')
    expect(translation).toContain('markId=same-id')
    expect(explain).toContain('**Explain**')
    expect(lookup).toContain('**Lookup**')
    expect(translation).toContain('**Translate**')
  })
})

describe('passage stores share markId', () => {
  const opened: DexieStorage[] = []
  afterEach(async () => {
    await Promise.all(opened.splice(0).map((storage) => storage.dispose()))
  })

  it('stores translate, explain, and lookup under the same markId', async () => {
    const storage = new DexieStorage({ dbName: `ai-passages-${Date.now()}` })
    opened.push(storage)
    const markId = sharedPassageMarkId('doc-1', range, 'the same passage')
    await upsertTranslate(storage, {
      markId,
      simpleId: 'doc-1',
      text: 'the same passage',
      pageNumber: 3,
      engine: 'edgemt',
      languageCode: 'zh-Hans',
      translatedText: '同一段',
    })
    await upsertExplain(storage, {
      markId,
      simpleId: 'doc-1',
      text: 'the same passage',
      pageNumber: 3,
      detail: 'brief',
      explanation: 'because',
    })
    await upsertLookup(storage, {
      markId,
      simpleId: 'doc-1',
      text: 'the same passage',
      pageNumber: 3,
      detail: 'brief',
      lookup: 'means',
    })
    const [translates, explains, lookups] = await Promise.all([
      listTranslateMarks(storage, 'doc-1'),
      listExplainMarks(storage, 'doc-1'),
      listLookupMarks(storage, 'doc-1'),
    ])
    expect(translates.map((item) => item.markId)).toEqual([markId])
    expect(explains.map((item) => item.markId)).toEqual([markId])
    expect(lookups.map((item) => item.markId)).toEqual([markId])
  })
})

describe('official AI without a license', () => {
  const opened: DexieStorage[] = []

  afterEach(async () => {
    resetLlm()
    await Promise.all(opened.splice(0).map((storage) => storage.dispose()))
  })

  it('does not call /reader/ai/generate', async () => {
    const storage = new DexieStorage({ dbName: `ai-license-${Date.now()}` })
    opened.push(storage)
    const post = vi.fn()
    const fetchImpl = vi.fn()
    bindAiRuntime({
      apiClient: {
        apiSettings: { endPoint: 'https://gw.example', appId: '20', getSecret: async () => '' },
        post,
        get: vi.fn(),
      } as unknown as IApiClient,
      storage,
      getLicense: () => '',
      onNeedLicense: () => undefined,
      onQuotaExhausted: () => undefined,
      fetchImpl,
    })
    await expect(
      getLlm().client.complete({
        taskId: 't1',
        platformId: DefaultOfficialPlatformId,
        model: DefaultOfficialModelName,
        purpose: 'explain',
        messages: [{ role: 'user', content: 'hello' }],
      }),
    ).rejects.toThrow(/license/i)
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(post).not.toHaveBeenCalled()
    const generateCalls = post.mock.calls.filter((call) => String(call[0]).includes(OFFICIAL_AI_GENERATE_PATH))
    expect(generateCalls).toHaveLength(0)
  })
})
