import { isNullOrWhiteSpace } from "../../../kernal/common/text";
import { Nav, SpineFile, FileLocation, NavPoint, IFileDecrypter, IStorage, Context, ILocale, IEventEmitter } from "../../../kernal";
import { IPdfFileParser, PdfFileParserOptions } from "./IPdfFileParser";
import * as pdfjsLib from '../../../pdfjs/legacy/build/pdf.mjs';
import { loadPdfDocument } from "../loadPdfDocument";
import { ITextDocument } from "../../../kernal/ITextDocument";
import { PdfTextDocument } from "./PdfTextDocument";
import { BaseFileParser } from "../../base/fileParser/BaseFileParser";
import { IHttpClient } from "../../../kernal/network/IHttpClient";
import { FileUrlParserOptions, IFileUrlParser, UrlParseResult } from "../../../kernal/services/fileUrlParser/IFileUrlParser";
import { IFileProvider } from "../../../kernal/services/file/IFileProvider";
import { ICrypto } from "../../../kernal/crypto/ICrypto";
import { PdfPasswordProvider } from "./PdfPasswordProvider";

export class PdfFileParser extends BaseFileParser implements IPdfFileParser {
    private readonly passwordProvider: PdfPasswordProvider;

    constructor(
        crypto: ICrypto,
        fileDecrypter: IFileDecrypter,
        fileProvider: IFileProvider,
        fileUrlParser: IFileUrlParser,
        httpClient: IHttpClient,
        public readonly events: IEventEmitter,
        public readonly locale: ILocale,
        public readonly context: Context,
        public readonly storage: IStorage | null,
        public readonly url: any,
        public readonly extension: string,
        public readonly options: PdfFileParserOptions,
    ) {
        super(crypto, fileDecrypter, fileProvider, fileUrlParser, httpClient, url, extension);
        this.passwordProvider = new PdfPasswordProvider(events, locale, context, storage);
        this.bindDefaultPasswordFlow();
    }

    /**
     * When showPasswordPrompt is on and no custom passwordPrompt is set,
     * emit EventNames.RequirePdfPassword for the host UI to handle.
     */
    private bindDefaultPasswordFlow() {
        if (!this.options.standardPasswordProvider) {
            this.options.standardPasswordProvider = this.passwordProvider.getPassword;
        }
    }

    override async buildLocation(target: NavPoint | string, docUrl?: string): Promise<FileLocation> {
        const navPoint = typeof target === "string" ? new NavPoint('', target) : target;
        const location = await super.buildLocation(target, docUrl);
        if ((navPoint.startPageNumber ?? 0) > 0) {
            location.current = navPoint.startPageNumber
            location.unit = 'page'
        }
        if (!isNullOrWhiteSpace(navPoint.pdfDest)) {
            location.pdfDest = navPoint.pdfDest;
        }
        return location;
    }

    override async getCover(width: number, height: number): Promise<Blob> {
        return null;
    }
    private textDocuments: ITextDocument[];
    override async getTextDocuments(): Promise<ITextDocument[]> {
        if (this.textDocuments) {
            return this.textDocuments;
        }
        this.textDocuments = [];
        const spineFiles = await this.getSpineFiles();
        for (let i = 0; i < spineFiles.length; i++) {
            const file = spineFiles[i]
            const textDocument = new PdfTextDocument(this, file);
            this.textDocuments.push(textDocument)
        }
        return this.textDocuments;
    }

    private getPdfSpineFileData = async (spineFile: SpineFile): Promise<Uint8Array | string> => {
        let data: Uint8Array;
        let foundData = false;
        if (spineFile.data) {
            if (spineFile.data instanceof ArrayBuffer) {
                if (spineFile.data.byteLength > 0) {
                    data = new Uint8Array(spineFile.data)
                    foundData = true;
                }
            }
            else {
                if (spineFile.data.size > 0) {
                    const buffer = await spineFile.data.arrayBuffer();
                    data = new Uint8Array(buffer)
                }
            }
        }
        if (!foundData) {
            if (!spineFile.url) {
                return new Uint8Array(0);
            }
            data = (await this.getFileBytes(spineFile.url)).data;
        }

        return data;
    }
    private pdfDocs = new Map<string, pdfjsLib.PDFDocumentProxy>();
    async getPdfDocument(spineFile: SpineFile): Promise<pdfjsLib.PDFDocumentProxy> {
        let doc = this.pdfDocs.get(spineFile.url)
        if (doc && !doc.loadingTask.destroyed) {
            return doc;
        }
        doc = await this.internalGetPdfDocumentProxy(spineFile)
        this.pdfDocs.set(spineFile.url, doc)
        return doc;
    }

    async internalGetPdfDocumentProxy(spineFile: SpineFile): Promise<pdfjsLib.PDFDocumentProxy> {
        let password: string;
        if (this.options.standardPasswordProvider) {
            password = await this.options.standardPasswordProvider(this, spineFile);
        }
        const data = await this.getPdfSpineFileData(spineFile)
        const doc = await loadPdfDocument(data, {
            password: password,
            cMapUrl: this.options.cMapUrl,
            standardFontDataUrl: this.options.standardFontDataUrl,
            showPasswordPrompt: this.options.showPasswordPrompt,
            passwordPrompt: this.passwordProvider.onPasswordPrompt,
            internalUrlBuilder: this.options.internalUrlBuilder
        })
        return doc;
    }

    private currentWholePdfFileHash: string;
    override async getFileHash(algorithm?: 'MD5' | 'SHA-1') {
        if (this.isMultiFiles) {
            return "";
        }
        if (!algorithm || algorithm == 'SHA-1') {
            if (this.currentWholePdfFileHash) {
                return this.currentWholePdfFileHash
            }

            const data = await Array.from(this.pdfDocs.values())[0].getData();
            this.currentWholePdfFileHash = await this.crypto.digest(data, 'SHA-1')
            return this.currentWholePdfFileHash;
        }

        const data = await Array.from(this.pdfDocs.values())[0].getData();
        return await this.crypto.digest(data, 'MD5')
    }

    protected override async parseUrl(url: any, options: FileUrlParserOptions): Promise<UrlParseResult> {
        const result = await super.parseUrl(url, options);
        if (!result.spineFiles) {
            result.spineFiles = [];
        }
        if (!result.isMultiFiles) {
            const rootSpineFile = new SpineFile(result.data, result.mainUrl, this.extension);
            const doc = await this.internalGetPdfDocumentProxy(rootSpineFile)
            // Add to cache
            for (let i = 0; i < doc.numPages; i++) {
                const spineFileUrl = `${i + 1}.pdf`; // Page numbers start from 1
                const spineFile = new SpineFile(null, spineFileUrl, this.extension);
                result.spineFiles.push(spineFile);
                this.pdfDocs.set(spineFileUrl, doc);
            }
            const nav = await this.initNav(doc);
            result.nav = nav;
        }
        return result;
    }

    protected override async measureFilePercentage(spineFiles: SpineFile[], requireCalculateFileSymbolCount: boolean): Promise<void> {
        if (!spineFiles) {
            return;
        }
        const symbolCountIsUndefined = spineFiles.find(x => x.symbolCount == undefined);
        if (!symbolCountIsUndefined) {
            if (spineFiles[0]?.ratio != null) {
                this.applyProgressRanges(spineFiles);
            }
            return;
        }
        // Calculate total progress
        let totalSymbolCount = 0;
        spineFiles.forEach((spineFile) => {
            if (spineFile.symbolCount == undefined || spineFile.symbolCount <= 0) {
                // If symbol count is less than or equal to 0, count as 1 (one file = one symbol)
                spineFile.symbolCount = 1;
            }

            totalSymbolCount += spineFile.symbolCount;
        });

        if (totalSymbolCount <= 0)
            totalSymbolCount = 1;

        spineFiles.forEach((spineFile) => {
            // Do not recalculate ratio when it already has a value, as it may be specified by the server
            // Note: do not use ! when checking numbers
            if (spineFile.ratio == null)
                spineFile.ratio = spineFile.symbolCount / totalSymbolCount;
        });
        this.applyProgressRanges(spineFiles);
    }

    override async getNav(): Promise<Nav> {
        const nav = await super.getNav();
        if (nav) {
            return nav;
        }
        return null;
    }

    override async dispose(): Promise<void> {
        await super.dispose();
        for (const [key, value] of this.pdfDocs.entries()) {
            try {
                await value.cleanup();
                if (value.loadingTask) {
                    await value.loadingTask.destroy();
                }
                await value.destroy();
            } catch (e) {
                //
            }
        }
        this.pdfDocs.clear();
        if (this.textDocuments) {
            for (const textDocument of this.textDocuments) {
                await textDocument.dispose();
            }
            this.textDocuments.splice(0)
        }
    }

    private async initNav(pdfDocument: pdfjsLib.PDFDocumentProxy): Promise<Nav> {
        const nav = new Nav();
        if (!pdfDocument) {
            return nav;
        }

        const outline = await pdfDocument.getOutline();
        if (outline == null || outline.length == 0)
            return nav;
        for (let i = 0; i < outline.length; i++) {
            const o = outline[i];
            const pageNumber = await this.getPageNumber(pdfDocument, o.dest);
            let pdfDest = await this.formatPdfDest(pdfDocument, o.dest);;
            const navPoint = await this.getNavPoint(pdfDocument, o.title, pageNumber, pdfDest, o.items);
            nav.navPoints.push(navPoint);
        }
        return nav;
    }


    private async getNavPoint(pdfDocument: pdfjsLib.PDFDocumentProxy, title: string, pageNumber: number, pdfDest: string, items: any[]) {

        // eslint-disable-next-line no-control-regex
        title = title?.trim().replace(/[\x00-\x1f]/gi, "");;
        let url = pageNumber.toString() + '.pdf';
        let startPageNumber = pageNumber;
        const navPoint = new NavPoint(title, url, startPageNumber, pdfDest);
        if (items != null && items.length > 0) {
            for (let i = 0; i < items.length; i++) {
                const pageNumber = await this.getPageNumber(pdfDocument, items[i].dest);
                let pdfDest = await this.formatPdfDest(pdfDocument, items[i].dest);
                const childNavPoint = await this.getNavPoint(pdfDocument, items[i].title, pageNumber, pdfDest, items[i].items)
                navPoint.children.push(childNavPoint);
            }
        }
        return navPoint;
    }

    private async formatPdfDest(pdfDocument: pdfjsLib.PDFDocumentProxy, dest: string | any[]) {
        let explicitDest: any;
        if (typeof dest === "string") {
            explicitDest = await pdfDocument.getDestination(dest);
        } else {
            explicitDest = dest;
        }
        return JSON.stringify(explicitDest)
    }

    private async getPageNumber(pdf: any, dest: any) {
        let explicitDest: any, pageNumber = 0;
        try {
            if (typeof dest === "string") {
                explicitDest = await pdf.getDestination(dest);
            } else {
                explicitDest = dest;
            }
            if (Array.isArray(explicitDest)) {
                const [destRef] = explicitDest;
                if (typeof destRef === "object" && destRef !== null) {
                    pageNumber = (await pdf.getPageIndex(destRef)) + 1;
                } else if (Number.isInteger(destRef)) {
                    pageNumber = destRef + 1;
                }
            }
        } catch (err) {
            // this.logger.error(err);
        }
        return pageNumber;
    }
}