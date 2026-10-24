import { FileSystemAdapter, type App, type TFile } from 'obsidian'
import type { ByteRangeReader } from './ByteRangeReader'

type NodeFileHandle = {
  stat: () => Promise<{ size: number }>
  read: (
    buffer: Uint8Array,
    offset: number,
    length: number,
    position: number,
  ) => Promise<{ bytesRead: number }>
  close: () => Promise<void>
}

type NodeFs = {
  promises: {
    open: (path: string, flags: string) => Promise<NodeFileHandle>
  }
}

const resolveNodeFs = (): NodeFs | undefined => {
  const requireFn = (window as Window & { require?: (id: string) => unknown }).require
  if (typeof requireFn !== 'function') {
    return undefined
  }
  try {
    return requireFn('fs') as NodeFs
  } catch {
    return undefined
  }
}

/**
 * Open a vault file as fixed-size windows. Returns undefined when the host
 * cannot read by offset, so callers never fall back to loading the whole file.
 */
export const openVaultFileRange = async (
  app: App,
  file: TFile,
): Promise<ByteRangeReader | undefined> => {
  const adapter = app.vault.adapter
  if (!(adapter instanceof FileSystemAdapter)) {
    return undefined
  }
  const fs = resolveNodeFs()
  if (!fs) {
    return undefined
  }
  const handle = await fs.promises.open(adapter.getFullPath(file.path), 'r')
  try {
    const stat = await handle.stat()
    return {
      size: stat.size,
      read: async (start, end) => {
        const length = Math.max(0, end - start)
        if (length === 0 || start >= stat.size) {
          return new Uint8Array(0)
        }
        const buffer = new Uint8Array(length)
        const { bytesRead } = await handle.read(buffer, 0, length, start)
        return buffer.subarray(0, bytesRead)
      },
      close: async () => {
        await handle.close()
      },
    }
  } catch (error) {
    await handle.close()
    throw error
  }
}
