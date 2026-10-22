import 'fake-indexeddb/auto'
import { createPublicKey, verify as verifySignature, webcrypto } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { canonicalSignQuery, ensureDeviceSignMaterial, SIGN_ALG } from '@/api/deviceSignKey'

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

  it('signs with a non-extractable P-256 key in IEEE P1363', async () => {
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
  })
})
