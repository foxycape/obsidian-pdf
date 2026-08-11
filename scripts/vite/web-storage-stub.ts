/**
 * Obsidian builds must not pull in vendor WebStorage → localforage
 * (localforage inlines an IE createElement("script") shim that fails review).
 * Runtime storage is injected via CoreServices.storage (DexieStorage).
 */
export class WebStorage {
  constructor() {
    throw new Error(
      'WebStorage is disabled in the Obsidian build. Pass CoreServices.storage instead.',
    )
  }
}
