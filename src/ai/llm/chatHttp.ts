const RETRY_STATUSES = new Set([408, 409, 429])

export type ChatDelta = {
  content?: string
  reasoning_content?: string
  reasoning?: string
  tool_calls?: {
    index?: number
    id?: string
    function?: { name?: string; arguments?: string }
  }[]
}

export type ChatCompletionMessage = {
  content?: string | null
  reasoning_content?: string
  reasoning?: string
  tool_calls?: unknown
}

export type ChatCompletionResponse = {
  choices?: Array<{
    message?: ChatCompletionMessage
  }>
}

export type ChatCompletionChunk = {
  choices?: Array<{
    delta?: ChatDelta
  }>
}

export type ChatHttpOptions = {
  apiKey: string
  baseURL: string
  headers?: Record<string, string>
  body: Record<string, unknown>
  signal?: AbortSignal
  fetchImpl: typeof fetch
  /** Extra attempts after the first failure. `1` matches the previous SDK setting. */
  maxRetries: number
}

export type ListModelsOptions = {
  apiKey: string
  baseURL: string
  fetchImpl: typeof fetch
  signal?: AbortSignal
  timeoutMs?: number
}

const endpoint = (baseURL: string, path: string): string => {
  const trimmed = baseURL.trim().replace(/\/+$/, '')
  if (!trimmed) {
    throw new Error('AI base URL is empty')
  }
  return `${trimmed}/${path.replace(/^\/+/, '')}`
}

const isAbortError = (error: unknown): boolean =>
  error instanceof Error && error.name === 'AbortError'

const shouldRetryStatus = (status: number): boolean =>
  RETRY_STATUSES.has(status) || status >= 500

const authHeaders = (
  apiKey: string,
  extra?: Record<string, string>,
): Record<string, string> => ({
  Authorization: `Bearer ${apiKey}`,
  ...extra,
})

const readErrorDetail = async (response: Response): Promise<string> => {
  try {
    return (await response.text()).slice(0, 500)
  } catch {
    return ''
  }
}

class HttpStatusError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message)
    this.name = 'HttpStatusError'
  }
}

const postJson = async (options: ChatHttpOptions): Promise<Response> => {
  const attempts = Math.max(0, options.maxRetries) + 1
  let lastError: unknown
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (options.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }
    try {
      const response = await options.fetchImpl(endpoint(options.baseURL, 'chat/completions'), {
        method: 'POST',
        headers: {
          ...authHeaders(options.apiKey, options.headers),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options.body),
        signal: options.signal,
      })
      if (response.ok) {
        return response
      }
      const detail = await readErrorDetail(response)
      const error = new HttpStatusError(
        `AI request failed (${response.status})${detail ? `: ${detail}` : ''}`,
        shouldRetryStatus(response.status),
      )
      if (!error.retryable || attempt === attempts - 1) {
        throw error
      }
      lastError = error
    } catch (error) {
      if (error instanceof HttpStatusError && !error.retryable) {
        throw error
      }
      if (isAbortError(error) || attempt === attempts - 1) {
        throw error
      }
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('AI request failed')
}

const sseData = (frame: string): string | null => {
  const lines = frame.split('\n')
  const dataLines: string[] = []
  for (const line of lines) {
    if (!line.startsWith('data:')) {
      continue
    }
    dataLines.push(line.slice(5).trimStart())
  }
  if (dataLines.length === 0) {
    return null
  }
  return dataLines.join('\n')
}

/** Join SSE frames that arrived split across reads. Yields each `data:` payload. */
export const readSseData = async function* (
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        buffer += decoder.decode()
        break
      }
      buffer += decoder.decode(value, { stream: true })
      buffer = buffer.replace(/\r\n/g, '\n')
      let splitAt = buffer.indexOf('\n\n')
      while (splitAt >= 0) {
        const frame = buffer.slice(0, splitAt)
        buffer = buffer.slice(splitAt + 2)
        const data = sseData(frame)
        if (data) {
          yield data
        }
        splitAt = buffer.indexOf('\n\n')
      }
    }
  } finally {
    reader.releaseLock()
  }
  const tail = sseData(buffer)
  if (tail) {
    yield tail
  }
}

export const createChatCompletion = async (
  options: ChatHttpOptions,
): Promise<ChatCompletionResponse> => {
  const response = await postJson({
    ...options,
    body: { ...options.body, stream: false },
  })
  return (await response.json()) as ChatCompletionResponse
}

export const streamChatCompletion = async function* (
  options: ChatHttpOptions,
): AsyncGenerator<ChatCompletionChunk> {
  const response = await postJson({
    ...options,
    body: { ...options.body, stream: true },
  })
  if (!response.body) {
    throw new Error('AI stream response has no body')
  }
  for await (const data of readSseData(response.body)) {
    if (data.trim() === '[DONE]') {
      return
    }
    yield JSON.parse(data) as ChatCompletionChunk
  }
}

export const listModelIds = async (options: ListModelsOptions): Promise<string[]> => {
  const controller = new AbortController()
  const timeoutMs = options.timeoutMs ?? 8000
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort()
    } else {
      options.signal.addEventListener('abort', () => controller.abort(), { once: true })
    }
  }
  try {
    const response = await options.fetchImpl(endpoint(options.baseURL, 'models'), {
      method: 'GET',
      headers: authHeaders(options.apiKey),
      signal: controller.signal,
    })
    if (!response.ok) {
      const detail = await readErrorDetail(response)
      throw new Error(`AI model list failed (${response.status})${detail ? `: ${detail}` : ''}`)
    }
    const payload = (await response.json()) as { data?: Array<{ id?: string }> }
    return (payload.data ?? [])
      .map((item) => item.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
  } catch (error) {
    if (timedOut && isAbortError(error)) {
      throw new Error('Model list timed out')
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}
