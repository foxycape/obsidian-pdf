import {
  openPdfDatabase,
  PDF_DB_NAME,
  SIGN_KEY_ID,
  SIGN_KEY_STORE,
} from '@/storage/pdfDatabaseSchema'

const ECDSA = { name: 'ECDSA', namedCurve: 'P-256' } as const

export const SIGN_ALG = 'ecdsa-p256-sha256'

type StoredSignKey = {
  id: typeof SIGN_KEY_ID
  privateKey: CryptoKey
  publicKeySpki: string
}

export type DeviceSignMaterial = {
  alg: typeof SIGN_ALG
  publicKeySpki: string
  sign: (query: string) => Promise<string>
}

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

const idbGet = async (db: IDBDatabase): Promise<StoredSignKey | undefined> =>
  new Promise((resolve, reject) => {
    const request = db.transaction(SIGN_KEY_STORE, 'readonly').objectStore(SIGN_KEY_STORE).get(SIGN_KEY_ID)
    request.onsuccess = () => resolve(request.result as StoredSignKey | undefined)
    request.onerror = () => reject(request.error ?? new Error('Failed to read the device signing key.'))
  })

const idbPut = async (db: IDBDatabase, value: StoredSignKey): Promise<void> =>
  new Promise((resolve, reject) => {
    const request = db.transaction(SIGN_KEY_STORE, 'readwrite').objectStore(SIGN_KEY_STORE).put(value)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error ?? new Error('Failed to store the device signing key.'))
  })

const requireSubtle = (): SubtleCrypto => {
  const subtle = window.crypto?.subtle
  if (!subtle) {
    throw new Error('WebCrypto is unavailable; cannot sign API requests.')
  }
  return subtle
}

const createStoredKey = async (): Promise<StoredSignKey> => {
  const subtle = requireSubtle()
  const pair = await subtle.generateKey(ECDSA, true, ['sign', 'verify'])
  const spki = await subtle.exportKey('spki', pair.publicKey)
  const pkcs8 = await subtle.exportKey('pkcs8', pair.privateKey)
  const privateKey = await subtle.importKey('pkcs8', pkcs8, ECDSA, false, ['sign'])
  return {
    id: SIGN_KEY_ID,
    privateKey,
    publicKeySpki: bytesToBase64(new Uint8Array(spki)),
  }
}

const signQuery = async (privateKey: CryptoKey, query: string): Promise<string> => {
  const signature = await requireSubtle().sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(query),
  )
  return bytesToBase64(new Uint8Array(signature))
}

const readOrCreateSignKey = async (): Promise<StoredSignKey> => {
  const db = await openPdfDatabase(PDF_DB_NAME)
  try {
    const stored = await idbGet(db)
    if (stored) {
      return stored
    }
    const created = await createStoredKey()
    await idbPut(db, created)
    return created
  } finally {
    db.close()
  }
}

let materialPromise: Promise<DeviceSignMaterial> | null = null

/** Ordinal key order, excluding the signature field. Matches the API verifier. */
export const canonicalSignQuery = (parameters: Record<string, unknown>): string => {
  const keys = Object.keys(parameters).filter((key) => key.toLowerCase() !== 'x_public_token')
  keys.sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
  return keys.map((key) => `${key}=${parameters[key] ?? ''}`).join('')
}

/**
 * Per-install ECDSA P-256 key stored in the business database.
 * The private key stays in IndexedDB and is not extractable.
 * The same promise is shared so concurrent requests do not create two keys.
 */
export const ensureDeviceSignMaterial = (): Promise<DeviceSignMaterial> => {
  if (materialPromise === null) {
    materialPromise = (async () => {
      const stored = await readOrCreateSignKey()
      if (!stored.privateKey || !stored.publicKeySpki) {
        throw new Error('Stored device signing key is incomplete.')
      }
      const material: DeviceSignMaterial = {
        alg: SIGN_ALG,
        publicKeySpki: stored.publicKeySpki,
        sign: (query: string) => signQuery(stored.privateKey, query),
      }
      return material
    })().catch((error: unknown) => {
      materialPromise = null
      throw error
    })
  }
  return materialPromise
}
