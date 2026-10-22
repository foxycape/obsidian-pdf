import { createMD5, createSHA1, createSHA256 } from 'hash-wasm';
import type { HashAlgorithm } from '@foxycape/core/kernal/crypto/ICrypto';

/** Read size for Blob/File hashing. hash-wasm copies each update into wasm memory. */
export const HASH_CHUNK_SIZE = 2 * 1024 * 1024;

/** simpleId is the MD5 of the first 5MB of a file. */
export const SIMPLE_ID_BYTE_LENGTH = 5 * 1024 * 1024;

export type DigestSource =
    | string
    | Blob
    | Uint8Array
    | ArrayBuffer
    | Promise<Blob>
    | FileSystemFileHandle;

export type HashSpec = {
    algorithm: HashAlgorithm;
    /** When set, only the first N bytes are fed to this hasher. */
    maxBytes?: number;
};

export type StreamingHasher = {
    update: (chunk: Uint8Array) => void;
    digest: () => string;
};

const createWasmHasher = (algorithm: HashAlgorithm) => {
    switch (algorithm) {
        case 'MD5':
            return createMD5();
        case 'SHA-1':
            return createSHA1();
        case 'SHA-256':
            return createSHA256();
        // case 'SHA-384':
        //     return createSHA384();
        // case 'SHA-512':
        //     return createSHA512();
        default:
            throw new Error(`Unsupported hash algorithm: ${algorithm}`);
    }
};

/**
 * Streaming hasher backed by hash-wasm. Each call gets its own wasm instance,
 * so different hashers can be updated one after another without sharing state.
 */
export const createHasher = async (algorithm: HashAlgorithm): Promise<StreamingHasher> => {
    const hasher = await createWasmHasher(algorithm);
    return {
        update: (chunk) => {
            hasher.update(chunk);
        },
        digest: () => hasher.digest(),
    };
};

type ByteSource = {
    size: number;
    read: (start: number, end: number) => Promise<Uint8Array>;
};

const memorySource = (bytes: Uint8Array): ByteSource => ({
    size: bytes.byteLength,
    read: async (start, end) => bytes.subarray(start, end),
});

const blobSource = (blob: Blob): ByteSource => ({
    size: blob.size,
    read: async (start, end) => new Uint8Array(await blob.slice(start, end).arrayBuffer()),
});

const isFileSystemFileHandle = (value: unknown): value is FileSystemFileHandle =>
    typeof FileSystemFileHandle !== 'undefined' && value instanceof FileSystemFileHandle;

const resolveByteSource = async (source: DigestSource): Promise<ByteSource> => {
    if (typeof source === 'string') {
        return memorySource(new TextEncoder().encode(source));
    }
    if (source instanceof Uint8Array) {
        return memorySource(source);
    }
    if (source instanceof ArrayBuffer) {
        return memorySource(new Uint8Array(source));
    }
    if (source instanceof Blob) {
        return blobSource(source);
    }
    if (isFileSystemFileHandle(source)) {
        return blobSource(await source.getFile());
    }
    return blobSource(await source);
};

/**
 * Hash one source with several algorithms in a single scan.
 * Hashers are updated sequentially; do not update the same wasm module concurrently.
 */
export const digestMany = async (
    source: DigestSource,
    specs: readonly HashSpec[],
    options?: { chunkSize?: number },
): Promise<string[]> => {
    if (specs.length === 0) {
        return [];
    }
    const chunkSize = options?.chunkSize ?? HASH_CHUNK_SIZE;
    if (chunkSize <= 0) {
        throw new Error('chunkSize must be greater than 0');
    }

    const hashers = await Promise.all(specs.map((spec) => createHasher(spec.algorithm)));
    const limits = specs.map((spec) => spec.maxBytes ?? Number.POSITIVE_INFINITY);
    const byteSource = await resolveByteSource(source);
    const readLength = Math.min(
        byteSource.size,
        limits.reduce((max, limit) => Math.max(max, limit), 0),
    );

    let offset = 0;
    while (offset < readLength) {
        const end = Math.min(offset + chunkSize, readLength);
        const chunk = await byteSource.read(offset, end);
        for (let index = 0; index < hashers.length; index++) {
            const limit = limits[index];
            if (offset >= limit) {
                continue;
            }
            const take = Math.min(chunk.byteLength, limit - offset);
            if (take <= 0) {
                continue;
            }
            hashers[index].update(take === chunk.byteLength ? chunk : chunk.subarray(0, take));
        }
        offset = end;
    }

    return hashers.map((hasher) => hasher.digest());
};

/** Stream a digest without loading a Blob or File into one ArrayBuffer. */
export const digestStream = async (
    source: DigestSource,
    algorithm: HashAlgorithm,
    options?: { chunkSize?: number; maxBytes?: number },
): Promise<string> => {
    const [hash] = await digestMany(
        source,
        [{ algorithm, maxBytes: options?.maxBytes }],
        { chunkSize: options?.chunkSize },
    );
    return hash;
};
