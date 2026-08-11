export interface ICrypto {
    /**
     * Compute a digest/hash of the given content.
     * @param data The data to compute the digest/hash of. When string, treated as UTF-8.
     * @param hashAlgorithm Optional hash algorithm, defaults to SHA-256
     * @returns
     */
    digest(data: string | Blob | Uint8Array | ArrayBuffer, hashAlgorithm?: HashAlgorithm): Promise<string>;
    /**
     * Encrypt the given data.
     * @param data The data to encrypt. When string, treated as UTF-8.
     * @param options The encryption options.
     * @returns The encrypted data.
     */
    encrypt(data: string | ArrayBuffer, options: CryptoOptions): Promise<ArrayBuffer>;
    /**
     * Decrypt the given data.
     * @param data The data to decrypt
     * @param options The decryption options.
     * @returns The decrypted data.
     */
    decrypt(data: ArrayBuffer, options: CryptoOptions): Promise<ArrayBuffer>;
}
export type HashAlgorithm = 'MD5' | 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512';
export type HashContent = Blob | Uint8Array | ArrayBuffer | Promise<Blob> | FileSystemFileHandle;
export type CryptoMode = 'CBC';
export class CryptoOptions {
    /** Encryption key. When string, treated as UTF-8. */
    key: string | ArrayBuffer;
    /** Initialization vector. When string, treated as UTF-8. */
    iv?: string | ArrayBuffer;
    mode?: CryptoMode;
    algorithm: 'aes' | 'rsa-oaep';
}
