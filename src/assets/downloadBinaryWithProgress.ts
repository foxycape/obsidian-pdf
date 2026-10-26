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
/** No new bytes for this long aborts the current host. */
const IDLE_TIMEOUT_MS = 5_000
/** Same-URL retries when the caller did not provide a fallback host. */
const MAX_DOWNLOAD_ATTEMPTS = 3
/** GitHub is tried once. The CDN mirror is tried twice. */
const FALLBACK_HOST_ATTEMPTS = 2
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

type NodeClientRequest = {
  on: (event: string, listener: (error: Error) => void) => void
  setTimeout: (ms: number, callback: () => void) => void
  destroy: (error?: Error) => void
}

type NodeHttpClient = {
  get: (
    url: string,
    options: { headers: Record<string, string> },
    callback: (response: NodeIncomingMessage) => void,
  ) => NodeClientRequest
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

type DownloadAccumulator = {
  chunks: Uint8Array[]
  loaded: number
  total: number
}

const createAccumulator = (): DownloadAccumulator => ({
  chunks: [],
  loaded: 0,
  total: 0,
})

const snapshotBytes = (acc: DownloadAccumulator): Uint8Array =>
  concatChunks(acc.chunks, acc.loaded)

const replaceAccumulator = (acc: DownloadAccumulator, bytes: Uint8Array) => {
  acc.chunks = [bytes]
  acc.loaded = bytes.byteLength
  acc.total = bytes.byteLength
}

export type BinaryDownloadOptions = {
  /** Tried in order after the primary URL fails or goes idle. */
  fallbackUrls?: string[]
  idleTimeoutMs?: number
}

const downloadWithNodeStream = (
  url: string,
  onProgress: DownloadProgressHandler,
  modules: { http: NodeHttpClient; https: NodeHttpClient },
  acc: DownloadAccumulator,
  idleTimeoutMs: number,
  redirectCount = 0,
): Promise<BinaryDownloadResult> =>
  new Promise((resolve, reject) => {
    if (redirectCount > MAX_REDIRECTS) {
      reject(new Error('Too many redirects while downloading runtime assets.'))
      return
    }

    const headers: Record<string, string> = { ...REQUEST_HEADERS }
    const startLoaded = acc.loaded
    if (startLoaded > 0) {
      headers.Range = `bytes=${startLoaded}-`
    }

    const client = url.startsWith('http:') ? modules.http : modules.https
    const request = client.get(url, { headers }, (response) => {
      const status = response.statusCode ?? 0
      const location = headerValue(response.headers.location)
      if (status >= 300 && status < 400 && location) {
        response.resume()
        const nextUrl = new URL(location, url).toString()
        downloadWithNodeStream(
          nextUrl,
          onProgress,
          modules,
          acc,
          idleTimeoutMs,
          redirectCount + 1,
        ).then(resolve, reject)
        return
      }

      if (status !== 200 && status !== 206) {
        response.resume()
        resolve({ status, bytes: snapshotBytes(acc) })
        return
      }

      if (status === 200 && startLoaded > 0) {
        acc.chunks = []
        acc.loaded = 0
        acc.total = 0
      }

      const partLength = Number(getHttpHeader(response.headers, 'content-length')) || 0
      const rangedTotal = parseContentRangeTotal(getHttpHeader(response.headers, 'content-range'))
      const total = rangedTotal || (partLength > 0 ? acc.loaded + partLength : acc.total)
      if (total > 0) {
        acc.total = total
      }
      onProgress(acc.loaded, acc.total)

      response.on('data', (chunk: unknown) => {
        const bytes = toUint8Array(chunk)
        if (bytes.byteLength === 0) {
          return
        }
        acc.chunks.push(bytes)
        acc.loaded += bytes.byteLength
        onProgress(acc.loaded, acc.total)
      })
      response.on('end', () => {
        if (acc.total > 0 && acc.loaded !== acc.total) {
          reject(new Error(`Incomplete download: received ${acc.loaded} of ${acc.total} bytes.`))
          return
        }
        resolve({ status: 200, bytes: snapshotBytes(acc) })
      })
      response.on('error', (error: unknown) => {
        reject(error instanceof Error ? error : new Error(String(error)))
      })
    })
    request.on('error', reject)
    request.setTimeout(idleTimeoutMs, () => {
      request.destroy(new Error('Download timed out'))
    })
  })

const appendPart = (acc: DownloadAccumulator, bytes: Uint8Array, total: number) => {
  acc.chunks.push(bytes)
  acc.loaded += bytes.byteLength
  if (total > 0) {
    acc.total = total
  }
}

const downloadByRangeOrFull = async (
  url: string,
  onProgress: DownloadProgressHandler,
  request: BinaryRequestFn,
  acc: DownloadAccumulator,
  idleTimeoutMs: number,
): Promise<BinaryDownloadResult> => {
  if (acc.loaded === 0) {
    const first = await requestWithIdleTimeout(
      request,
      url,
      {
        ...REQUEST_HEADERS,
        Range: `bytes=0-${RANGE_CHUNK_SIZE - 1}`,
      },
      idleTimeoutMs,
    )

    if (first.status !== 200 && first.status !== 206) {
      return { status: first.status, bytes: snapshotBytes(acc) }
    }

    const firstBytes = new Uint8Array(first.arrayBuffer)
    if (first.status === 200) {
      const declared = Number(getHttpHeader(first.headers, 'content-length')) || 0
      if (declared > 0 && firstBytes.byteLength !== declared) {
        throw new Error(
          `Incomplete download: received ${firstBytes.byteLength} of ${declared} bytes.`,
        )
      }
      replaceAccumulator(acc, firstBytes)
      onProgress(acc.loaded, acc.total)
      return { status: 200, bytes: snapshotBytes(acc) }
    }

    const total =
      parseContentRangeTotal(getHttpHeader(first.headers, 'content-range')) ||
      Number(getHttpHeader(first.headers, 'content-length')) ||
      0
    appendPart(acc, firstBytes, total)
    onProgress(acc.loaded, acc.total)
  }

  if (acc.total <= 0) {
    const full = await requestWithIdleTimeout(
      request,
      url,
      { ...REQUEST_HEADERS },
      idleTimeoutMs,
    )
    if (full.status !== 200) {
      return { status: full.status, bytes: snapshotBytes(acc) }
    }
    const bytes = new Uint8Array(full.arrayBuffer)
    replaceAccumulator(acc, bytes)
    onProgress(acc.loaded, acc.total)
    return { status: 200, bytes: snapshotBytes(acc) }
  }

  while (acc.loaded < acc.total) {
    const start = acc.loaded
    const end = Math.min(acc.total, start + RANGE_CHUNK_SIZE) - 1
    const part = await requestWithIdleTimeout(
      request,
      url,
      {
        ...REQUEST_HEADERS,
        Range: `bytes=${start}-${end}`,
      },
      idleTimeoutMs,
    )
    if (part.status === 200) {
      const bytes = new Uint8Array(part.arrayBuffer)
      replaceAccumulator(acc, bytes)
      onProgress(acc.loaded, acc.total)
      return { status: 200, bytes: snapshotBytes(acc) }
    }
    if (part.status !== 206) {
      return { status: part.status, bytes: snapshotBytes(acc) }
    }
    const partBytes = new Uint8Array(part.arrayBuffer)
    const expected = end - start + 1
    if (partBytes.byteLength !== expected) {
      throw new Error(
        `Incomplete download: received ${partBytes.byteLength} of ${expected} bytes.`,
      )
    }
    appendPart(acc, partBytes, acc.total)
    onProgress(acc.loaded, acc.total)
  }

  if (acc.loaded !== acc.total) {
    throw new Error(`Incomplete download: received ${acc.loaded} of ${acc.total} bytes.`)
  }

  return { status: 200, bytes: snapshotBytes(acc) }
}

const requestWithIdleTimeout = async (
  request: BinaryRequestFn,
  url: string,
  headers: Record<string, string>,
  idleTimeoutMs: number,
) => {
  let timer: number | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = window.setTimeout(() => reject(new Error('Download timed out')), idleTimeoutMs)
  })
  try {
    return await Promise.race([request(url, headers), timeout])
  } finally {
    if (timer !== undefined) {
      window.clearTimeout(timer)
    }
  }
}

const shouldRetryStatus = (status: number) => status === 0 || status >= 500

const downloadOnce = async (
  url: string,
  onProgress: DownloadProgressHandler,
  request: BinaryRequestFn,
  acc: DownloadAccumulator,
  idleTimeoutMs: number,
): Promise<BinaryDownloadResult> => {
  const modules = getNodeHttpModules()
  if (modules) {
    try {
      return await downloadWithNodeStream(url, onProgress, modules, acc, idleTimeoutMs)
    } catch {
      // Node http(s) can fail where requestUrl still works. Keep bytes already received.
    }
  }
  return downloadByRangeOrFull(url, onProgress, request, acc, idleTimeoutMs)
}

/**
 * Download a binary URL and report byte progress.
 * Desktop uses Node `http(s)` streams; otherwise Range requests via `requestUrl`.
 * With `fallbackUrls`, the primary host is tried once. A 10 second idle gap, a
 * connection error, 404, or 5xx switches to the next host and continues from the
 * bytes already received.
 */
export const downloadBinaryWithProgress = async (
  url: string,
  onProgress: DownloadProgressHandler = () => undefined,
  request: BinaryRequestFn = requestWithObsidian,
  options: BinaryDownloadOptions = {},
): Promise<BinaryDownloadResult> => {
  const fallbackUrls = options.fallbackUrls ?? []
  const hasFallback = fallbackUrls.length > 0
  const hosts = [url, ...fallbackUrls]
  const idleTimeoutMs = options.idleTimeoutMs ?? IDLE_TIMEOUT_MS
  const acc = createAccumulator()
  let lastError: unknown

  for (let hostIndex = 0; hostIndex < hosts.length; hostIndex += 1) {
    const attempts = hasFallback
      ? hostIndex === 0
        ? 1
        : FALLBACK_HOST_ATTEMPTS
      : MAX_DOWNLOAD_ATTEMPTS
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const result = await downloadOnce(
          hosts[hostIndex] ?? url,
          onProgress,
          request,
          acc,
          idleTimeoutMs,
        )
        if (result.status === 200) {
          return result
        }
        const moreHosts = hostIndex < hosts.length - 1
        if (hasFallback && moreHosts) {
          break
        }
        if (
          !hasFallback &&
          shouldRetryStatus(result.status) &&
          attempt < attempts - 1
        ) {
          continue
        }
        if (hasFallback && attempt < attempts - 1) {
          continue
        }
        return result
      } catch (error) {
        lastError = error
        const moreHosts = hostIndex < hosts.length - 1
        if (attempt < attempts - 1) {
          continue
        }
        if (hasFallback && moreHosts) {
          break
        }
        throw error
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Download failed')
}
