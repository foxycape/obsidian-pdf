/** Random-access bytes. `read` uses a half-open range `[start, end)`. */
export type ByteRangeReader = {
  readonly size: number
  read: (start: number, end: number) => Promise<Uint8Array>
  close: () => Promise<void>
}
