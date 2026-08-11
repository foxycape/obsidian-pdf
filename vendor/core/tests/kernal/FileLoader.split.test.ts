import { describe, expect, it, vi } from 'vitest'
import { EventEmitter } from '@/kernal/EventEmitter'
import { FileLoader } from '@/kernal/FileLoader'
import { Options } from '@/kernal/Options'
import { Reader } from '@/kernal/Reader'
import { FileLoadPipeline } from '@/kernal/pipelines/FileLoadPipeline'
import type { IFileParser } from '@/kernal/IFileParser'
import { Metadata } from '@/kernal/Metadata'

class TestReader extends Reader {}

describe('Reader / FileLoader split', () => {
  it('requires container on Reader.open', async () => {
    const reader = new TestReader(new Options())
    await expect(reader.open('book.pdf' as any, undefined as any, undefined as any)).rejects.toThrow(/container is required/)
  })

  it('FileLoader.load parses without DOM via pipeline', async () => {
    const fileParser = {
      load: vi.fn(async () => undefined),
      getFileHash: vi.fn(async () => 'hash-1'),
      getMetadata: vi.fn(async () => new Metadata()),
      dispose: vi.fn(async () => undefined),
    } as unknown as IFileParser

    const mediaTypeRegistry = {
      createFileParser: vi.fn(async () => fileParser),
    }

    const inputFormatter = {
      guardUrl: vi.fn(),
      formatInputParameters: vi.fn(async () => ({
        url: 'book.pdf',
        openOptions: {},
        extension: '.pdf',
      })),
      getIds: vi.fn(async () => ({
        simpleId: 'simple-1',
        resourceId: '',
        isExternalId: false,
      })),
      formatParserUrl: vi.fn(() => ({ url: 'book.pdf', abortController: undefined })),
      formatLocation: vi.fn(() => ({ location: undefined, percentage: undefined })),
    }

    const pipeline = new FileLoadPipeline({
      inputFormatter: inputFormatter as any,
      mediaTypeRegistry: mediaTypeRegistry as any,
      services: { get: vi.fn() } as any,
      options: new Options(),
      events: new EventEmitter(),
      lifecycle: {},
    })

    const result = await pipeline.load('book.pdf')

    expect(result.extension).toBe('.pdf')
    expect(result.resourceId).toBe('hash-1')
    expect(result.fileParser).toBe(fileParser)
    expect(result.context.rootContainer).toBeUndefined()
    expect(fileParser.load).toHaveBeenCalledOnce()
  })

  it('exposes FileLoader composition on Reader', () => {
    const reader = new TestReader(new Options())
    expect(reader.fileLoader).toBeInstanceOf(FileLoader)
    expect(reader.mediaTypeRegistry).toBe(reader.fileLoader.mediaTypeRegistry)
    expect(reader.services).toBe(reader.fileLoader.services)
  })

  it('registers core services on FileLoader and UI services on Reader', () => {
    const loader = new FileLoader(new Options())
    expect(loader.services.has('httpClient')).toBe(true)
    expect(loader.services.has('notifier' as any)).toBe(false)
    expect(loader.services.has('loading' as any)).toBe(false)

    const reader = new TestReader(new Options())
    expect(reader.services.has('httpClient')).toBe(true)
    expect(reader.services.has('notifier')).toBe(true)
    expect(reader.services.has('loading')).toBe(true)
  })
})
