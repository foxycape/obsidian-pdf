import { requestUrl } from 'obsidian'

const resolveUrl = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') {
    return input
  }
  if (input instanceof URL) {
    return input.href
  }
  return input.url
}

const headersToRecord = (headers: HeadersInit | undefined): Record<string, string> => {
  const record: Record<string, string> = {}
  if (!headers) {
    return record
  }
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      record[key] = value
    })
    return record
  }
  if (Array.isArray(headers)) {
    for (const [key, value] of headers) {
      record[key] = value
    }
    return record
  }
  return { ...headers }
}

const bodyToString = (body: BodyInit | null | undefined): string | undefined => {
  if (body == null) {
    return undefined
  }
  if (typeof body === 'string') {
    return body
  }
  return undefined
}

/**
 * Non-streaming calls go through Obsidian `requestUrl` (no CORS).
 * Streaming calls use global `fetch` so SSE can arrive incrementally.
 */
export const createObsidianAiFetch = (): typeof fetch => {
  return async (input, init) => {
    const body = bodyToString(init?.body)
    const wantsStream = !!body && /"stream"\s*:\s*true/.test(body)
    if (wantsStream) {
      return globalThis.fetch(input, init)
    }
    const response = await requestUrl({
      url: resolveUrl(input),
      method: init?.method ?? 'POST',
      headers: headersToRecord(init?.headers),
      body,
      throw: false,
    })
    const contentType = response.headers['content-type'] ?? 'application/json'
    return new Response(response.text, {
      status: response.status,
      headers: { 'content-type': contentType },
    })
  }
}
