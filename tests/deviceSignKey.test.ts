import 'fake-indexeddb/auto'
import { createPublicKey, verify as verifySignature, webcrypto } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { canonicalSignQuery, ensureDeviceSignMaterial, SIGN_ALG } from '@/api/deviceSignKey'
import { PDF_DB_NAME, SIGN_KEY_ID, SIGN_KEY_STORE, openPdfDatabase } from '@/storage/pdfDatabaseSchema'

if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
}

describe('device signing key', () => {
  it('orders keys by UTF-16 code unit and drops the token', () => {
    expect(
      canonicalSignQuery({
        X_Public_Token: 'skip',
        X_Public_b: '2',
        X_Public_B: '1',
      }),
    ).toBe('X_Public_B=1X_Public_b=2')
  })

  it('signs with a non-extractable P-256 key stored in the business database', async () => {
    const material = await ensureDeviceSignMaterial()
    const query = 'X_Public_AppId=20X_Public_SignAlg=ecdsa-p256-sha256'
    const signature = await material.sign(query)
    const key = createPublicKey({
      key: Buffer.from(material.publicKeySpki, 'base64'),
      format: 'der',
      type: 'spki',
    })
    expect(material.alg).toBe(SIGN_ALG)
    expect(
      verifySignature(
        'sha256',
        Buffer.from(query),
        { key, dsaEncoding: 'ieee-p1363' },
        Buffer.from(signature, 'base64'),
      ),
    ).toBe(true)

    const names = (await indexedDB.databases()).map((database) => database.name)
    expect(names).toContain(PDF_DB_NAME)
    expect(names).not.toContain('foxycape-pdf-device-sign')
    const db = await openPdfDatabase(PDF_DB_NAME)
    const row = await new Promise<{ publicKeySpki?: string } | undefined>((resolve, reject) => {
      const request = db.transaction(SIGN_KEY_STORE, 'readonly').objectStore(SIGN_KEY_STORE).get(SIGN_KEY_ID)
      request.onsuccess = () => resolve(request.result as { publicKeySpki?: string } | undefined)
      request.onerror = () => reject(request.error)
    })
    db.close()
    expect(row?.publicKeySpki).toBe(material.publicKeySpki)
  })
})
