/**
 * Ambient types for vendor WebStorage only.
 * Obsidian builds stub localforage at bundle time; this keeps vue-tsc happy.
 */
declare module 'localforage' {
  type LocalForageDriver = string

  type LocalForageOptions = {
    driver?: LocalForageDriver | LocalForageDriver[]
    name?: string
    storeName?: string
    version?: number
    description?: string
  }

  type LocalForage = {
    INDEXEDDB: LocalForageDriver
    WEBSQL: LocalForageDriver
    LOCALSTORAGE: LocalForageDriver
    getItem: <T>(key: string) => Promise<T | null>
    setItem: <T>(key: string, value: T) => Promise<T>
    removeItem: (key: string) => Promise<void>
    clear: () => Promise<void>
    length: () => Promise<number>
    keys: () => Promise<string[]>
    iterate: <T, U>(
      iteratee: (value: T, key: string, iterationNumber: number) => U,
    ) => Promise<U>
    createInstance: (options: LocalForageOptions) => LocalForage
    dropInstance: (options: { name?: string; storeName?: string }) => Promise<void>
  }

  const localforage: LocalForage
  export default localforage
}

type LocalForage = import('localforage').default
