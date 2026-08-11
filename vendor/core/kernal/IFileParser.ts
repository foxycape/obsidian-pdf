import { isNullOrWhiteSpace } from "./common/text";
import { getRandomId } from "./common/uuid";
import { FileLocation, IDisposable, Metadata, Nav, NavPoint } from ".";
import { ITextDocument } from "./ITextDocument";
import { OpenOptions } from "./OpenOptions";

export interface IFileParser extends IDisposable {
    /** File path or data */
    readonly url: any;
    /** File extension of the current file */
    readonly extension: string;

    /** Whether this is a multi-file package */
    get isMultiFiles(): boolean

    /**
     * Load data
     * @param options Load options
     */
    load(options?: FileLoadOptions): Promise<void>;

    /**
     * Hash of the entire file. Returns null for split files. (Available only after the file is loaded)
     * @param algorithm Defaults to SHA-1
     */
    getFileHash(algorithm?: 'MD5' | 'SHA-1'): Promise<string>;

    /**
     * Get resource metadata
     */
    getMetadata(): Promise<Metadata>;

    /**
     * Get entry file data
     */
    getEntryFile(): Promise<SpineFile>;

    /**
    * Get a file stream from the package (returns Uint8Array by default)
    * @param key Remote file path or path relative to the package root
    * @param parentUrl Parent file path
    */
    getFile<T extends keyof ReturnFileFormatMap = 'uint8array'>(key: string, parentUrl?: string, format?: T): Promise<ReturnFileFormatMap[T]>;

    /**
     * Build an in-document navigation location
     * @param target Navigation point or in-document URL
     * @param docUrl
     */
    buildLocation(target: NavPoint | string, docUrl?: string): Promise<FileLocation>;

    /**
     * Sign a URL
     * @param key
     */
    // signUrl(key: string): Promise<string>;

    /**
     * Get navigation (table of contents) info
     */
    getNav(): Promise<Nav>;

    /**
     * Get the spine file for the given URL
     * @param url
     */
    getSpineFile(url: string): Promise<SpineFile>

    /**
     * Get readable files in the package
     */
    getSpineFiles(): Promise<SpineFile[]>;

    /**
     * Get the resource cover image
     * @param width Specified width
     * @param height Specified height
     */
    getCover(width: number, height: number): Promise<Blob>;

    /**
     * Get text documents
     */
    getTextDocuments(): Promise<ITextDocument[]>

    /**
     * Get a text document
     * @param url
     */
    getTextDocument(url: string): Promise<ITextDocument>
}

export class SpineFile {

    /** Whether this is a linear reading file ("yes" or "no"), defaults to "yes" */
    linear?: string;

    /** Symbol count used for progress calculation.
     * For audio/video: duration in seconds;
     * For plain text: character count;
     * For HTML: custom — e.g. whether embedded audio counts toward length;
     * For PDF: page count
    */
    symbolCount: number;

    /**
     * Ratio (share) within a set of files; values across the set sum to 1
     */
    ratio: number;

    /**
     * Overall progress at the start of this file (sum of preceding ratios)
     */
    startProgress: number;

    /**
     * Overall progress at the end of this file (startProgress + ratio)
     */
    endProgress: number;

    /**
     * Plain-text ratio within a set of files; values across the set sum to 1
     */
    charRatio: number;

    /**
     * Overall plain-text progress at the start of this file
     */
    charStartProgress: number;

    /**
     * Overall plain-text progress at the end of this file
     */
    charEndProgress: number;

    /**
     * Constructor
     * @param data Data content
     * @param url Real URL or unique data key (when the document is loaded from ArrayBuffer, a unique key is computed automatically)
     * @param extension File extension
     */
    constructor(public data?: ArrayBuffer | Blob, public url?: string, public extension?: string) {
        let dataLength = 0;
        if (data) {
            if (data instanceof ArrayBuffer) {
                dataLength = data.byteLength;
            }
            else if (data instanceof Blob) {
                dataLength = data.size;
            }
        }
        if ((data == undefined || dataLength == 0) && isNullOrWhiteSpace(url)) {
            // throw new Error("both data and url are empty");
        }

        if (isNullOrWhiteSpace(url)) {
            this.url = getRandomId();
        }
    }
}

export class FilePackage extends OpenOptions {
    /** File URL; mutually exclusive with spineFiles.
     * Allowed types: string | ArrayBuffer | Blob | FileSystemFileHandle
    */
    fileUrl?: any;
    /** Linear file list; mutually exclusive with fileUrl */
    spineFiles?: SpineFile[];

    /** Custom decryption key */
    customKey?: string
}


export type ReturnFileFormatMap = {
    arraybuffer: ArrayBuffer;
    uint8array: Uint8Array;
    blob: Blob;
};

export type FileLoadOptions = {
    measureFilePercentage?: boolean;
}