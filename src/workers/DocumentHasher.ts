/** MD5 and streaming SHA-1. Production runs this inside a Worker. */
export type DocumentHasher = {
  computeMd5: (bytes: Uint8Array) => Promise<string>
  beginSha1: () => Promise<void>
  updateSha1: (chunk: Uint8Array) => Promise<void>
  digestSha1: () => Promise<string>
  /**
   * Run `task` without another chunked SHA-1 starting.
   * A chunked SHA-1 must stay inside one exclusive call.
   */
  exclusive: <T>(task: () => Promise<T>) => Promise<T>
}
