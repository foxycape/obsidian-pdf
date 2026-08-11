import { isNumber } from "../../../kernal/common/number";
import { getUrlFragment } from "../../../kernal/common/url";
import { createElement } from "../../../kernal/html/injector";
import { DocumentProcessHandler, FileLocation, IDocument, IDocumentsProvider, IFileParser, SpineFile } from "../../../kernal";
import { Reader } from "../../../kernal/Reader";

export abstract class BaseDocumentsProvider<T extends IDocument = IDocument, W extends IFileParser = IFileParser> implements IDocumentsProvider<T, W> {
    protected documentItems: T[] = [];
    private readonly documentPreprocessHandlers: DocumentProcessHandler[] = [];
    private readonly documentPostprocessHandlers: DocumentProcessHandler[] = [];
    constructor(
        public readonly owner: Reader,
        public readonly fileParser: W
    ) {

    }

    /** Provider-level preprocess handlers applied to every document (before doc-local ones). */
    get documentPreprocesses(): readonly DocumentProcessHandler[] {
        return this.documentPreprocessHandlers;
    }

    /** Provider-level postprocess handlers applied to every document (before doc-local ones). */
    get documentPostprocesses(): readonly DocumentProcessHandler[] {
        return this.documentPostprocessHandlers;
    }

    /**
     * Register a document preprocess handler. Returns unsubscribe.
     */
    addDocumentPreprocess = (handler: DocumentProcessHandler): (() => void) => {
        this.documentPreprocessHandlers.push(handler);
        return () => this.removeDocumentPreprocess(handler);
    };

    private removeDocumentPreprocess = (handler: DocumentProcessHandler): void => {
        const index = this.documentPreprocessHandlers.indexOf(handler);
        if (index >= 0) {
            this.documentPreprocessHandlers.splice(index, 1);
        }
    };

    /**
     * Register a document postprocess handler. Returns unsubscribe.
     */
    addDocumentPostprocess = (handler: DocumentProcessHandler): (() => void) => {
        this.documentPostprocessHandlers.push(handler);
        return () => this.removeDocumentPostprocess(handler);
    };

    private removeDocumentPostprocess = (handler: DocumentProcessHandler): void => {
        const index = this.documentPostprocessHandlers.indexOf(handler);
        if (index >= 0) {
            this.documentPostprocessHandlers.splice(index, 1);
        }
    };

    abstract getRendererContainer(): HTMLElement
    abstract getScrollElement(): HTMLElement
    abstract createDocument(documentContainer: HTMLElement, file: SpineFile, fileIndex: number): Promise<T>
    abstract load(location?: FileLocation, isReload?: boolean): Promise<void>

    protected async initialize(documentsWrapper: HTMLElement) {
        const spineFiles = await this.fileParser.getSpineFiles();
        const filesLength = spineFiles.length;
        const documentFragment = documentsWrapper.ownerDocument.createDocumentFragment();
        for (let i = 0; i < filesLength; i++) {
            const file = spineFiles[i];
            const documentContainer = createElement(documentsWrapper.ownerDocument, "div", "", { "doc-url": file.url });
            documentFragment.appendChild(documentContainer);
            const doc = await this.createDocument(documentContainer, file, i);
            this.documentItems.push(doc);
        }

        documentsWrapper.appendChild(documentFragment);
    }

    reload = async (): Promise<void> => {
        const location = this.owner.context.currentLocation
        if (!location)
            return;
        await this.load(location, true);
    }

    getDocuments(): T[] {
        return this.documentItems;
    }
    getLoadedDocuments(): T[] {
        return this.documentItems;
    }
    getVisibleDocuments(): T[] {
        return this.documentItems;
    }
    getFirstVisibleDocument(): T {
        const documents = this.getVisibleDocuments();
        if (documents.length == 0)
            return null;
        return documents[0];

    }
    getLastVisibleDocument(): T {
        const documents = this.getVisibleDocuments();
        if (documents.length == 0)
            return null;
        return documents[documents.length - 1];
    }
    getDocument(url: string): T {
        if (!url) {
            return null;
        }
        const documents = this.getDocuments();
        const isNumericUrl = isNumber(url)
        if (isNumericUrl) {
            return documents[parseInt(url)];
        }
        const urlWithoutAnchor = getUrlFragment(url)?.urlWithoutAnchor;
        if (!urlWithoutAnchor) {
            return null;
        }
        return documents.find(x => x.url == urlWithoutAnchor);
    }

    async dispose(): Promise<void> {
        const loadedDocuments = this.getLoadedDocuments();
        for (let i = 0; i < loadedDocuments.length; i++) {
            await loadedDocuments[i].dispose();
        }
        this.documentItems = [];
        this.documentPreprocessHandlers.length = 0;
        this.documentPostprocessHandlers.length = 0;
    }
}
