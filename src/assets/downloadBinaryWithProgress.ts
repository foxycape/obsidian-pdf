import { Platform, requestUrl } from 'obsidian'

export type BinaryDownloadResult = {
  status: number
  bytes: Uint8Array
}

export type DownloadProgressHandler = (loaded: number, total: number) => void

export type BinaryRequestFn = (
  url: string,
  headers?: Record<string, string>,
) => Promise<{
  status: number
  headers: Record<string, string>
  arrayBuffer: ArrayBuffer
}>

const MAX_REDIRECTS = 10
const RANGE_CHUNK_SIZE = 256 * 1024
const REQUEST_HEADERS = {
  Accept: '*/*',
  'User-Agent': 'Foxycape-PDF-Obsidian',
} as const

type NodeIncomingMessage = {
  statusCode?: number
  headers: Record<string, string | string[] | undefined>
  resume: () => void
  on: (event: string, listener: (...args: unknown[]) => void) => void
}

type NodeHttpClient = {
  get: (
    url: string,
    options: { headers: Record<string, string> },
    callback: (response: NodeIncomingMessage) => void,
  ) => { on: (event: string, listener: (error: Error) => void) => void }
}

const requestWithObsidian: BinaryRequestFn = async (url, headers) => {
  const response = await requestUrl({
    url,
    headers,
    throw: false,
  })
  return {
    status: response.status,
    headers: response.headers ?? {},
    arrayBuffer: response.arrayBuffer,
  }
}

const headerValue = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) {
    return value[0] ?? ''
  }
  return value ?? ''
}

export const getHttpHeader = (
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string => {
  const lower = name.toLowerCase()
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower) {
      return headerValue(value)
    }
  }
  return ''
}

export const parseContentRangeTotal = (contentRange: string): number => {
  const match = /\/(\d+)\s*$/.exec(contentRange)
  if (!match) {
    return 0
  }
  const total = Number(match[1])
  return Number.isFinite(total) && total > 0 ? total : 0
}

const concatChunks = (chunks: Uint8Array[], totalLength: number): Uint8Array => {
  const bytes = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

const toUint8Array = (chunk: unknown): Uint8Array => {
  if (chunk instanceof Uint8Array) {
    return chunk
  }
  if (chunk instanceof ArrayBuffer) {
    return new Uint8Array(chunk)
  }
  return new Uint8Array()
}

const getNodeHttpModules = (): { http: NodeHttpClient; https: NodeHttpClient } | null => {
  if (!Platform.isDesktopApp) {
    return null
  }
  const requireFn = (window as Window & { require?: (id: string) => NodeHttpClient }).require
  if (typeof requireFn !== 'function') {
    return null
  }
  try {
    return {
      http: requireFn('http'),
      https: requireFn('https'),
    }
  } catch {
    return null
  }
}

const downloadWithNodeStream = (
  url: string,
  onProgress: DownloadProgressHandler,
  modules: { http: NodeHttpClient; https: NodeHttpClient },
  redirectCount = 0,
): Promise<BinaryDownloadResult> =>
  new Promise((resolve, reject) => {
    if (redirectCount > MAX_REDIRECTS) {
      reject(new Error('Too many redirects while downloading runtime assets.'))
      return
    }

    const client = url.startsWith('http:') ? modules.http : modules.https
    const request = client.get(url, { headers: { ...REQUEST_HEADERS } }, (response) => {
      const status = response.statusCode ?? 0
      const location = headerValue(response.headers.location)
      if (status >= 300 && status < 400 && location) {
        response.resume()
        const nextUrl = new URL(location, url).toString()
        downloadWithNodeStream(nextUrl, onProgress, modules, redirectCount + 1).then(
          resolve,
          reject,
        )
        return
      }

      if (status !== 200) {
        response.resume()
        resolve({ status, bytes: new Uint8Array(0) })
        return
      }

      const total = Number(getHttpHeader(response.headers, 'content-length')) || 0
      const chunks: Uint8Array[] = []
      let loaded = 0
      onProgress(0, total)

      response.on('data', (chunk: unknown) => {
        const bytes = toUint8Array(chunk)
        if (bytes.byteLength === 0) {
          return
        }
        chunks.push(bytes)
        loaded += bytes.byteLength
        onProgress(loaded, total)
      })
      response.on('end', () => {
        resolve({ status: 200, bytes: concatChunks(chunks, loaded) })
      })
      response.on('error', (error: unknown) => {
        reject(error instanceof Error ? error : new Error(String(error)))
      })
    })
    request.on('error', reject)
  })

const downloadByRangeOrFull = async (
  url: string,
  onProgress: DownloadProgressHandler,
  request: BinaryRequestFn,
): Promise<BinaryDownloadResult> => {
  const first = await request(url, {
    ...REQUEST_HEADERS,
    Range: `bytes=0-${RANGE_CHUNK_SIZE - 1}`,
  })

  if (first.status !== 200 && first.status !== 206) {
    return { status: first.status, bytes: new Uint8Array(0) }
  }

  const firstBytes = new Uint8Array(first.arrayBuffer)
  if (first.status === 200) {
    onProgress(firstBytes.byteLength, firstBytes.byteLength)
    return { status: 200, bytes: firstBytes }
  }

  const total =
    parseContentRangeTotal(getHttpHeader(first.headers, 'content-range')) ||
    Number(getHttpHeader(first.headers, 'content-length')) ||
    0
  const chunks = [firstBytes]
  let loaded = firstBytes.byteLength
  onProgress(loaded, total)

  if (total <= 0) {
    const full = await request(url, { ...REQUEST_HEADERS })
    if (full.status !== 200) {
      return { status: full.status, bytes: new Uint8Array(0) }
    }
    const bytes = new Uint8Array(full.arrayBuffer)
    onProgress(bytes.byteLength, bytes.byteLength)
    return { status: 200, bytes }
  }

  while (loaded < total) {
    const start = loaded
    const end = Math.min(total, start + RANGE_CHUNK_SIZE) - 1
    const part = await request(url, {
      ...REQUEST_HEADERS,
      Range: `bytes=${start}-${end}`,
    })
    if (part.status === 200) {
      const bytes = new Uint8Array(part.arrayBuffer)
      onProgress(bytes.byteLength, bytes.byteLength)
      return { status: 200, bytes }
    }
    if (part.status !== 206) {
      return { status: part.status, bytes: new Uint8Array(0) }
    }
    const partBytes = new Uint8Array(part.arrayBuffer)
    if (partBytes.byteLength === 0) {
      break
    }
    chunks.push(partBytes)
    loaded += partBytes.byteLength
    onProgress(loaded, total)
  }

  return { status: 200, bytes: concatChunks(chunks, loaded) }
}

/**
 * Download a binary URL and report byte progress.
 * Desktop uses Node `http(s)` streams; otherwise Range requests via `requestUrl`.
 */
export const downloadBinaryWithProgress = async (
  url: string,
  onProgress: DownloadProgressHandler = () => undefined,
  request: BinaryRequestFn = requestWithObsidian,
): Promise<BinaryDownloadResult> => {
  const modules = getNodeHttpModules()
  if (modules) {
    try {
      return await downloadWithNodeStream(url, onProgress, modules)
    } catch {
      // Fall through to requestUrl (CORS-free, coarser progress).
    }
  }
  return downloadByRangeOrFull(url, onProgress, request)
}
