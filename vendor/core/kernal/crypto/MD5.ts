import SparkMD5 from 'spark-md5';
import { toBlob } from '../common/buffer';
import { computeUniqueId } from '../common/uuid';

/**
 * Compute MD5 hash of a string (UTF-8).
 */
export const hashMd5 = (data: string): string => {
    return SparkMD5.hash(data);
};

/**
 * Compute MD5 hash of binary data in 2MB chunks.
 */
export const computeMd5 = async (data: ArrayBuffer): Promise<string> => {
    const blob = toBlob(data);
    const fileReader = new FileReader();
    const prototype = File.prototype as any;
    const blobSlice = prototype.mozSlice || prototype.webkitSlice || prototype.slice;
    const chunkSize = 2097152;
    // read in chunks of 2MB
    const chunks = Math.ceil(blob.size / chunkSize);
    let currentChunk = 0;
    const spark = new SparkMD5.ArrayBuffer();
    return await new Promise<string>((resolve, reject) => {
        fileReader.onerror = (e: ProgressEvent<FileReader>) => {
            reject(e);
        };
        fileReader.onload = (e: ProgressEvent<FileReader>) => {
            spark.append(e.target?.result as any);
            currentChunk++;

            if (currentChunk < chunks) {
                loadNext();
            } else {
                resolve(spark.end());
            }
        };

        const loadNext = () => {
            const start = currentChunk * chunkSize;
            const end = start + chunkSize >= blob.size ? blob.size : start + chunkSize;
            fileReader.readAsArrayBuffer(blobSlice.call(blob, start, end));
        };

        loadNext();
    });
};

/**
    * compute the simple id of the file
    * @param file 
    * @returns 
    */
export const computeSimpleId = async (file: string | Blob | Uint8Array | ArrayBuffer | Promise<Blob> | FileSystemFileHandle): Promise<string> => {
    if (typeof file === "string") {
        return computeUniqueId(file);
    }
    let actualFile: Blob;
    if (globalThis.FileSystemFileHandle && file instanceof FileSystemFileHandle) {
        actualFile = await file.getFile();
    }
    else if (file instanceof ArrayBuffer) {
        actualFile = toBlob(file);
    }
    else if (file instanceof Uint8Array) {
        actualFile = toBlob(file);
    }
    else if (file instanceof Blob) {
        actualFile = file;
    }
    else {
        actualFile = await (file as Promise<Blob>);
    }
    let simpleId: string;
    const takeByteLength: number = 5 * 1024 * 1024;
    if (actualFile.size > takeByteLength) {
        actualFile = actualFile.slice(0, takeByteLength)
    }       
    const partFileBuffer = await actualFile.arrayBuffer();
    simpleId = await computeMd5(partFileBuffer);
    return simpleId;
}