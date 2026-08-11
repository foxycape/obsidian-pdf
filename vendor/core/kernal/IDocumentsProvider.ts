import { DocumentProcessHandler, IDocument } from "./IDocument";
import { IDisposable } from "./IDisposable";
import { FileLocation } from "./progress/Progress";
import type { Reader } from "./Reader";
import { IFileParser } from "./IFileParser";

/**
 * documents loading and collection query.
 */
export interface IDocumentsProvider<T extends IDocument = IDocument,W extends IFileParser = IFileParser> extends IDisposable {
    /**
     * reload file
     */
    reload(): Promise<void>;

    /**
     * load file
     * @param location
     * @param isReload whether to reload
     */
    load(location?: FileLocation, isReload?: boolean): Promise<void>;

    /**
    * get all documents
    */
    getDocuments(): T[];

    /**
     * get loaded documents
     */
    getLoadedDocuments(): T[];

    /**
     * get current visible documents collection
     */
    getVisibleDocuments(): T[];

    /**
     * get first visible document
     * @param containVisibleElements whether to contain visible elements
     */
    getFirstVisibleDocument(containVisibleElements?: boolean): T;

    /**
     * get last visible document
     * @param containVisibleElements whether to contain visible elements
     */
    getLastVisibleDocument(containVisibleElements?: boolean): T

    /**
    * get document
     * @param url url or document index
     */
    getDocument(url: string): T;

    /**
     * get render container element
     */
    getRendererContainer(): HTMLElement;

    /**
     * get scroll element
     */
    getScrollElement(): HTMLElement;

    /**
     * get file parser
     */
    get fileParser(): W;

    /**
     * get reader instance
     */
    get owner(): Reader;

    /** Provider-level preprocess handlers applied to every document (before doc-local ones). */
    get documentPreprocesses(): readonly DocumentProcessHandler[];

    /** Provider-level postprocess handlers applied to every document (before doc-local ones). */
    get documentPostprocesses(): readonly DocumentProcessHandler[];

    /**
     * Register a document preprocess handler. Returns unsubscribe.
     */
    addDocumentPreprocess(handler: DocumentProcessHandler): () => void;

    /**
     * Register a document postprocess handler. Returns unsubscribe.
     */
    addDocumentPostprocess(handler: DocumentProcessHandler): () => void;
}
