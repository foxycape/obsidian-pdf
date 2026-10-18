import type { IStorage } from '@/storage/IStorage'
import { classifyLegacyMarkTables } from './classifyLegacyMarkTables'

/** In-memory view of leftover `mark-{hash}` KV tables. Loaded once at plugin start. */
export class LegacyMarkCatalog {
  readonly md5 = new Set<string>()
  readonly sha1 = new Set<string>()

  get hasPending(): boolean {
    return this.md5.size > 0 || this.sha1.size > 0
  }

  async load(storage: IStorage): Promise<void> {
    const classified = classifyLegacyMarkTables(await storage.getTableNames())
    this.md5.clear()
    this.sha1.clear()
    for (const name of classified.md5) {
      this.md5.add(name)
    }
    for (const name of classified.sha1) {
      this.sha1.add(name)
    }
  }
}
