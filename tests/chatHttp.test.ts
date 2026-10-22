import { describe, expect, it, vi } from 'vitest'
import {
  createChatCompletion,
  listModelIds,
  readSseData,
  streamChatCompletion,
  type ChatHttpOptions,
} from '@/ai/llm/chatHttp'

const encoder = new TextEncoder()

const sseResponse = (chunks: string[], status = 200): Response => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })
  return new Response(stream, {
    status,
    headers: { 'content-type': 'text/event-stream' },
  })
}

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

const callAt = (fetchImpl: ReturnType<typeof vi.fn>, index: number): [string, RequestInit] =>
  fetchImpl.mock.calls[index] as unknown as [string, RequestInit]

const baseOptions = (fetchImpl: typeof fetch): ChatHttpOptions => ({
  apiKey: 'sk-test',
  baseURL: 'https://example.test/v1/',
  headers: { purpose: 'chat' },
  body: { model: 'm', messages: [{ role: 'user', content: 'hi' }] },
  fetchImpl,
  maxRetries: 1,
})

describe('chatHttp', () => {
  it('joins split SSE frames and stops at DONE', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"hel'))
        controller.enqueue(encoder.encode('lo"}}]}\n\ndata: [DONE]\n\n'))
        controller.close()
      },
    })
    const frames: string[] = []
    for await (const frame of readSseData(body)) {
      frames.push(frame)
    }
    expect(frames).toEqual(['{"choices":[{"delta":{"content":"hello"}}]}', '[DONE]'])
  })

  it('posts chat completions once and reads the message', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ choices: [{ message: { content: 'ok' } }] }),
    )
    const result = await createChatCompletion(baseOptions(fetchImpl))
    expect(result.choices?.[0]?.message?.content).toBe('ok')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = callAt(fetchImpl, 0)
    expect(url).toBe('https://example.test/v1/chat/completions')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test')
    expect((init.headers as Record<string, string>).purpose).toBe('chat')
    expect(JSON.parse(String(init.body))).toMatchObject({ stream: false, model: 'm' })
  })

  it('retries a chat request once after a server error', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'busy' }, 503))
      .mockResolvedValueOnce(jsonResponse({ choices: [{ message: { content: 'later' } }] }))
    const result = await createChatCompletion(baseOptions(fetchImpl))
    expect(result.choices?.[0]?.message?.content).toBe('later')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('does not retry a client error', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: 'bad' }, 400))
    await expect(createChatCompletion(baseOptions(fetchImpl))).rejects.toThrow(/400/)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('streams deltas from SSE', async () => {
    const fetchImpl = vi.fn(async () =>
      sseResponse([
        'data: {"choices":[{"delta":{"content":"a"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"b"}}]}\n\n',
        'data: [DONE]\n\n',
      ]),
    )
    const parts: string[] = []
    for await (const chunk of streamChatCompletion(baseOptions(fetchImpl))) {
      parts.push(chunk.choices?.[0]?.delta?.content ?? '')
    }
    expect(parts).toEqual(['a', 'b'])
    const body = JSON.parse(String(callAt(fetchImpl, 0)[1].body))
    expect(body.stream).toBe(true)
  })

  it('lists the first page of model ids and does not retry', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'no' }, 401))
    await expect(
      listModelIds({
        apiKey: 'sk-test',
        baseURL: 'https://example.test/v1',
        fetchImpl,
        timeoutMs: 50,
      }),
    ).rejects.toThrow(/401/)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = callAt(fetchImpl, 0)
    expect(url).toBe('https://example.test/v1/models')
    expect(init.method).toBe('GET')
  })

  it('returns model ids from the first page', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ data: [{ id: 'b' }, { id: '' }, { id: 'a' }] }),
    )
    await expect(
      listModelIds({
        apiKey: 'sk',
        baseURL: 'https://example.test/v1',
        fetchImpl,
      }),
    ).resolves.toEqual(['b', 'a'])
  })
})
