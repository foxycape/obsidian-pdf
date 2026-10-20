import { describe, expect, it } from 'vitest'
import {
  downloadBinaryWithProgress,
  getHttpHeader,
  parseContentRangeTotal,
  type BinaryRequestFn,
} from '@/assets/downloadBinaryWithProgress'

const bytesOf = (text: string) => new TextEncoder().encode(text)

describe('downloadBinaryWithProgress', () => {
  it('parses Content-Range totals and header names case-insensitively', () => {
    expect(parseContentRangeTotal('bytes 0-255/2048')).toBe(2048)
    expect(parseContentRangeTotal('bytes 0-255/*')).toBe(0)
    expect(
      getHttpHeader({ 'Content-Range': 'bytes 0-1/8', 'content-length': '2' }, 'content-range'),
    ).toBe('bytes 0-1/8')
  })

  it('reports progress across 206 range chunks', async () => {
    const payload = new Uint8Array(300 * 1024)
    payload.fill(7)
    const calls: string[] = []
    const progress: Array<[number, number]> = []
    const request: BinaryRequestFn = async (_url, headers) => {
      const range = headers?.Range ?? ''
      calls.push(range)
      const match = /^bytes=(\d+)-(\d+)$/.exec(range)
      if (!match) {
        return { status: 400, headers: {}, arrayBuffer: new ArrayBuffer(0) }
      }
      const start = Number(match[1])
      const end = Math.min(Number(match[2]), payload.byteLength - 1)
      const slice = payload.slice(start, end + 1)
      return {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${payload.byteLength}`,
        },
        arrayBuffer: slice.buffer.slice(slice.byteOffset, slice.byteOffset + slice.byteLength),
      }
    }

    const result = await downloadBinaryWithProgress(
      'https://example.com/assets.zip',
      (loaded, total) => {
        progress.push([loaded, total])
      },
      request,
    )

    expect(result.status).toBe(200)
    expect(result.bytes.byteLength).toBe(payload.byteLength)
    expect(result.bytes.every((value) => value === 7)).toBe(true)
    expect(calls.length).toBeGreaterThan(1)
    expect(progress.at(-1)).toEqual([payload.byteLength, payload.byteLength])
  })

  it('treats a 200 response to Range as a complete file', async () => {
    const payload = bytesOf('full-zip')
    const request: BinaryRequestFn = async () => ({
      status: 200,
      headers: { 'Content-Length': String(payload.byteLength) },
      arrayBuffer: payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength),
    })

    const result = await downloadBinaryWithProgress(
      'https://example.com/assets.zip',
      () => undefined,
      request,
    )
    expect(result.status).toBe(200)
    expect(new TextDecoder().decode(result.bytes)).toBe('full-zip')
  })

  it('returns the HTTP status when the download fails', async () => {
    let calls = 0
    const request: BinaryRequestFn = async () => {
      calls += 1
      return {
        status: 404,
        headers: {},
        arrayBuffer: new ArrayBuffer(0),
      }
    }
    const result = await downloadBinaryWithProgress(
      'https://example.com/missing.zip',
      () => undefined,
      request,
    )
    expect(result.status).toBe(404)
    expect(result.bytes.byteLength).toBe(0)
    expect(calls).toBe(1)
  })

  it('retries when a 200 body is shorter than Content-Length', async () => {
    let calls = 0
    const payload = bytesOf('complete-body')
    const request: BinaryRequestFn = async () => {
      calls += 1
      if (calls === 1) {
        const short = bytesOf('short')
        return {
          status: 200,
          headers: { 'Content-Length': '100' },
          arrayBuffer: short.buffer.slice(short.byteOffset, short.byteOffset + short.byteLength),
        }
      }
      return {
        status: 200,
        headers: { 'Content-Length': String(payload.byteLength) },
        arrayBuffer: payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength),
      }
    }

    const result = await downloadBinaryWithProgress(
      'https://example.com/assets.zip',
      () => undefined,
      request,
    )
    expect(calls).toBe(2)
    expect(new TextDecoder().decode(result.bytes)).toBe('complete-body')
  })

  it('resumes from the CDN after GitHub sends no new bytes', async () => {
    const payload = new Uint8Array(300 * 1024)
    payload.fill(9)
    const github =
      'https://github.com/foxycape/obsidian-pdf/releases/download/3.4.4/pdfjs.zip'
    const cdn = 'https://cdn.tiefeiying.com/obsidian-pdf/3.4.4/pdfjs.zip'
    const calls: Array<{ url: string; range: string }> = []
    const request: BinaryRequestFn = (url, headers) => {
      const range = headers?.Range ?? ''
      calls.push({ url, range })
      const match = /^bytes=(\d+)-(\d+)$/.exec(range)
      if (!match) {
        return Promise.resolve({ status: 400, headers: {}, arrayBuffer: new ArrayBuffer(0) })
      }
      const start = Number(match[1])
      const end = Math.min(Number(match[2]), payload.byteLength - 1)
      if (url === github && start > 0) {
        return new Promise(() => undefined)
      }
      const slice = payload.slice(start, end + 1)
      return Promise.resolve({
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${payload.byteLength}`,
        },
        arrayBuffer: slice.buffer.slice(slice.byteOffset, slice.byteOffset + slice.byteLength),
      })
    }

    const result = await downloadBinaryWithProgress(
      github,
      () => undefined,
      request,
      {
        fallbackUrls: [cdn],
        idleTimeoutMs: 30,
      },
    )

    expect(result.status).toBe(200)
    expect(result.bytes.byteLength).toBe(payload.byteLength)
    expect(result.bytes.every((value) => value === 9)).toBe(true)
    expect(calls[0]).toEqual({ url: github, range: 'bytes=0-262143' })
    expect(calls.some((call) => call.url === cdn && call.range.startsWith('bytes=262144-'))).toBe(
      true,
    )
  })
})
