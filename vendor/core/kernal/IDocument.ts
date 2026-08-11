import { IDisposable, IFileParser, Reader } from ".";
import type { SimpleMatrix } from "./shape/SimpleMatrix";

export type DocumentProcessHandler = (doc: IDocument) => Promise<void>;

export interface IDocument extends IDisposable {
    /** Whether running inside an iframe */
    get inIframe(): boolean

    /** Document URL or index (when the document is loaded from an ArrayBuffer, only the index is available) */
    get url(): string;

    /** Document name */
    get fileName(): string;

    /** Document file extension */
    get extension(): string;

    /**
     * Get the document root path
     */
    getRoot(): string;

    /**
     * Load the document
     */
    load(): Promise<void>;

    /**
     * Get the load status
     */
    getLoadStatus(): LoadStatus;

    /**
     * Get the current document wrapper container
     */
    getWrapperContainer(): HTMLElement;

    /**
     * Get the current document content container (returns the iframe body if an iframe exists; otherwise same as getWrapperContainer)
     */
    getContentContainer(): HTMLElement;

    /**
     * Get the file parser
     */
    get fileParser(): IFileParser;

    /**
     * Get the plain text of the current document
     * @param options
     */
    getText(options?: TextFormatOptions): Promise<string>;

    get owner(): Reader;
}

export class GotoResult {
    /**
     * Constructor
     * @param success Whether the navigation succeeded
     * @param atStart Whether already at the start position
     * @param atEnd Whether already at the end position
     */
    constructor(public success: boolean, public atStart: boolean, public atEnd: boolean) {

    }
}

export class ImageDescriptor {
    /**
     * Constructor
     * @param imageUrl Original HTML image path, or PDF image ObjId
     * @param docUrl Path of the document that contains the image
     * @param tagName Name of the tag that contains the image
     * @param tagIndex Index of the tag that contains the image
     */
    constructor(public imageUrl: string, public docUrl?: string, public tagName?: string, public tagIndex?: number) {
        this.id = docUrl + imageUrl;
    }

    /** Unique image identifier (note: this id is not the PDF objId; for PDF, the objId is imageUrl) */
    readonly id: string;

    /** Image data */
    imageData?: any;

    /**
     * Accessible image URL
     */
    accessibleImageUrl?: string;
    /**
     * Original image width
     */
    width?: number;
    /**
     * Original image height
     */
    height?: number

    /** X coordinate of the image on the canvas */
    x?: number;
    /** Y coordinate of the image on the canvas */
    y?: number;
    /** Scaled width of the image on the canvas */
    scaledWidth?: number;
    /** Scaled height of the image on the canvas */
    scaledHeight?: number;

    matrix?: SimpleMatrix

    /** PDF image reference object id */
    imageRefId?: string;

    /** PDF in-document destination parameter */
    pdfDest?: string;
}

export class ImageActionDescriptor {
    doc?: IDocument
    imageUrl?: string
    e?: Event
    imageDescriptors?: ImageDescriptor[]
    /** Whether this is an external image */
    isExternal?: boolean;
    /** Source: direct - clicked the image directly; indirect - opened via another button */
    from?: 'direct' | 'indirect'
}

export class TextFormatOptions {
    /** Whether to convert end-of-line characters to CRLF (true changes text length; not suitable for precise positioning) */
    convertEOLToCRLF?: boolean;

    /** Whether to remove whitespace between CJK characters (true changes text length; not suitable for precise positioning) */
    removeCJWhitespace?: boolean;

    /** Whether to try merging lines to avoid breaking sentences (true changes text length; not suitable for precise positioning) */
    combineLines?: boolean;

    /** Whether to remove consecutive whitespace characters (true changes text length; not suitable for precise positioning) */
    removeConsecutiveWhitespaceCharacters?: boolean

    /** Whether to remove consecutive blank lines (true changes text length; not suitable for precise positioning) */
    removeConsecutiveBlankLine?: boolean;

    /** Whether to convert line feeds to whitespace */
    convertLFToWhitespace?: boolean;
}

export class ExtractImageOptions {
    /** Whether to include images embedded inside SVG */
    includeSvgInternalImage?: boolean;
    /** Minimum width */
    minWidth?: number;
    /** Minimum height */
    minHeight?: number;

    /** Whether the image extraction task has been aborted */
    aborted?: () => boolean;
}

export type LoadStatus = "success" | "fail" | "loading" | "unstart";
