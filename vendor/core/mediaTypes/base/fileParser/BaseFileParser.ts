
import { getMimetype } from "../../../kernal/common/mimetypes";
import { isNumber } from "../../../kernal/common/number";
import { getExtension, getFileName } from "../../../kernal/common/path";
import { isNullOrWhiteSpace } from "../../../kernal/common/text";
import { checkIsAbsoluteUrl, checkIsBlobUrl, getFullUrl, getUrlFragment } from "../../../kernal/common/url";
import { toBlob } from "../../../kernal/common/buffer";
import { ITextDocument } from "../../../kernal/ITextDocument";
import { IFileParser, Nav, SpineFile, DecryptFile, Metadata, FilePackage, ReturnFileFormatMap, FileLocation, NavPoint, SymbolType, BrowserCapabilities, FileLoadOptions } from "../../../kernal";
import { FileUrlParserOptions, IFileUrlParser, UrlParseResult } from "../../../kernal/services/fileUrlParser/IFileUrlParser";
import { IFileDecrypter } from "../../../kernal/services/file/IFileDecrypter";
import { IFileProvider } from "../../../kernal/services/file/IFileProvider";
import { IHttpClient } from "../../../kernal/network/IHttpClient";
import { ICrypto } from "../../../kernal/crypto/ICrypto";

export abstract class BaseFileParser implements IFileParser {
    private nav: Nav = new Nav();
    private metadata: Metadata = new Metadata();
    private spineFiles: SpineFile[] = [];

    /**
     * constructor
     * @param crypto Crypto service
     * @param fileDecrypter File decrypter service
     * @param fileProvider File provider service
     * @param fileUrlParser File url parser service
     * @param httpClient HTTP client service
     * @param url URL, URL array, or ArrayBuffer to parse
     * @param extension file extension of the input data
     */
    constructor(
        protected readonly crypto: ICrypto,
        protected readonly fileDecrypter: IFileDecrypter,
        protected readonly fileProvider: IFileProvider,
        protected readonly fileUrlParser: IFileUrlParser,
        protected readonly httpClient: IHttpClient,
        public readonly url: any,
        public readonly extension: string,
    ) {

    }


    async buildLocation(target: NavPoint | string, docUrl?: string): Promise<FileLocation> {
        const navPoint = typeof target === "string" ? new NavPoint('', target) : target;
        const location = new FileLocation(navPoint.url, 1, 'ratio')
        return location;
    }

    async getTextDocuments(): Promise<ITextDocument[]> {
        return [];
    }

    async getTextDocument(url: string): Promise<ITextDocument> {
        const textDocuments = await this.getTextDocuments();
        const isNumericUrl = isNumber(url)
        if (isNumericUrl) {
            const index = parseInt(url);
            return textDocuments[index];
        }
        const urlWithoutAnchor = getUrlFragment(url).urlWithoutAnchor;
        return textDocuments.find(x => x.url == urlWithoutAnchor);
    }

    abstract getCover(width: number, height: number): Promise<Blob>;

    private currentIsMultiFiles: boolean
    get isMultiFiles(): boolean {
        return this.currentIsMultiFiles ?? false;
    }

    abstract getFileHash(algorithm?: "MD5" | "SHA-1"): Promise<string>;

    private currentWholeFileHash: string;
    protected async computeFileHash(isMultiFiles: boolean, data: ArrayBuffer, algorithm?: 'MD5' | 'SHA-1') {
        if (isMultiFiles) {
            return "";
        }
        if (!algorithm || algorithm == 'SHA-1') {
            if (this.currentWholeFileHash) {
                return this.currentWholeFileHash
            }
            this.currentWholeFileHash = await this.crypto.digest(data, "SHA-1");
            return this.currentWholeFileHash;
        }
        return await this.crypto.digest(data, "MD5");
    }

    async load(options?: FileLoadOptions): Promise<void> {
        const result = await this.parseUrl(this.url, { requireDownload: false });
        await this.initializeDatas(result);
        if (options?.measureFilePercentage) {
            await this.measureFilePercentage(this.spineFiles, this.urlParseResult?.requireCalculateFileSymbolCount)
        }
    }

    protected async parseUrl(url: any, options: FileUrlParserOptions) {
        options = options ?? new FileUrlParserOptions();
        const result = await this.fileUrlParser.parse(url, options)

        if (this.fileDecrypter && result.data) {
            const customKey = this.url instanceof FilePackage ? this.url.customKey : "";
            const fileUrl = typeof this.url === "string" ? this.url as string : "";
            const extension = this.extension || "";
            const callbackFile = new DecryptFile(extension, new Uint8Array(result.data), fileUrl)
            callbackFile.key = customKey;
            const decryptedData = await this.fileDecrypter.decrypt(callbackFile)
            if (decryptedData) {
                result.data = decryptedData.buffer as ArrayBuffer;
            }
        }
        return result;
    }

    private urlParseResult: UrlParseResult
    protected async initializeDatas(result: UrlParseResult) {
        this.urlParseResult = result;
        this.currentIsMultiFiles = result.isMultiFiles ?? false;
        this.spineFiles = result.spineFiles ?? [];
        if (result?.metadata) {
            this.metadata = result.metadata;
        }
        if (result?.nav) {
            this.nav = result.nav;
        }
    }

    protected async measureFilePercentage(spineFiles: SpineFile[], requireCalculateFileSymbolCount: boolean) {
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
        const filesLength = spineFiles.length;
        if (requireCalculateFileSymbolCount) {
            for (let i = 0; i < filesLength; i++) {
                const spineFile = spineFiles[i];
                // Note: do not use ! when checking numbers
                if (spineFile.ratio == null && (spineFile.symbolCount == undefined || spineFile.symbolCount <= 0)) {
                    const symbolCount = await this.calculateSymbolCount(spineFile, 'custom');
                    spineFile.symbolCount = symbolCount;
                    spineFile["charSymbolCount"] = await this.calculateSymbolCount(spineFile, 'char');
                }
                await BrowserCapabilities.yieldToMain();
            }
        }

        // Calculate total progress
        let totalSymbolCount = 0;
        let totalCharSymbolCount = 0;
        spineFiles.forEach((spineFile) => {
            if (spineFile.symbolCount == undefined || spineFile.symbolCount <= 0) {
                // If symbol count is less than or equal to 0, treat it as 1 (one file equals one symbol)
                spineFile.symbolCount = 1;
            }

            totalSymbolCount += spineFile.symbolCount;
            totalCharSymbolCount += spineFile["charSymbolCount"] ?? 0;
        });

        if (totalSymbolCount <= 0)
            totalSymbolCount = 1;
        if (totalCharSymbolCount <= 0)
            totalCharSymbolCount = 1;

        spineFiles.forEach((spineFile) => {
            // Do not recalculate when ratio already has a value; it may be set by the server
            // Note: do not use ! when checking numbers
            if (spineFile.ratio == null)
                spineFile.ratio = spineFile.symbolCount / totalSymbolCount;
            spineFile.charRatio = (spineFile["charSymbolCount"] ?? 0) / totalCharSymbolCount;
        });
        this.applyProgressRanges(spineFiles);
    }

    /** Derive each file's [startProgress, endProgress] from ratios for O(1)/find lookup. */
    protected applyProgressRanges(spineFiles: SpineFile[]) {
        let startProgress = 0;
        let charStartProgress = 0;
        for (const spineFile of spineFiles) {
            const ratio = spineFile.ratio ?? 0;
            const charRatio = spineFile.charRatio ?? 0;
            spineFile.startProgress = startProgress;
            spineFile.endProgress = startProgress + ratio;
            startProgress = spineFile.endProgress;
            spineFile.charStartProgress = charStartProgress;
            spineFile.charEndProgress = charStartProgress + charRatio;
            charStartProgress = spineFile.charEndProgress;
        }
    }

    protected async calculateSymbolCount(spineFile: SpineFile, symbolType: SymbolType) {
        return 1;
    }

    protected async getSpineFileData(spineFile: SpineFile) {
        if (!spineFile.data)
            return null;
        if (spineFile.data instanceof ArrayBuffer) {
            return spineFile.data;
        }
        else if (spineFile.data instanceof Blob) {
            return await spineFile.data.arrayBuffer();
        }
        return null;
    }

    async getMetadata(): Promise<Metadata> {
        if (!this.metadata) {
            this.metadata = new Metadata();
        }
        return this.metadata;
    }

    async getEntryFile(): Promise<SpineFile> {
        const spineFiles = await this.getSpineFiles();
        return spineFiles[0];
    }

    async getFile<T extends keyof ReturnFileFormatMap = "uint8array">(key: string, parentUrl?: string, format?: T): Promise<ReturnFileFormatMap[T]> {
        const data: ReturnFileFormatMap = {
            'arraybuffer': null,
            'blob': null,
            'uint8array': null,
        };
        if (!format) {
            format = 'uint8array' as T;
        }
        if (format == 'uint8array' || format == 'arraybuffer') {
            let bytesDataResult: { data: Uint8Array, type: string };
            try {
                bytesDataResult = await this.getFileBytes(key, parentUrl)
            }
            catch (e) {
                bytesDataResult = { data: new Uint8Array(), type: '' }
            }
            if (format == 'uint8array') {
                data['uint8array'] = bytesDataResult.data;
            }
            else {
                data['arraybuffer'] = bytesDataResult.data.buffer as ArrayBuffer;
            }
            return data[format]
        }
        else {
            if (format == 'blob') {
                let blob: Blob
                try {
                    blob = await this.getFileBlob(key, parentUrl)
                }
                catch (e) {
                    blob = toBlob(new Uint8Array());
                }
                data['blob'] = blob;
                return data[format]
            }
        }
        return null;
    }


    protected async getFileBlob(key: string, parentUrl?: string): Promise<Blob> {
        const { data, type } = await this.getFileBytes(key, parentUrl);
        return toBlob(data, { type: type });
    }

    protected async getFileBytes(key: string, parentUrl?: string): Promise<{ data: Uint8Array, type: string }> {
        if (isNullOrWhiteSpace(key)) {
            throw new Error("File url is empty");
        }
        const url = this.buildUrl(key, parentUrl);
        if (isNullOrWhiteSpace(url)) {
            throw new Error("File url is empty");
        }
        let data: ArrayBuffer;
        if (this.fileProvider) {
            data = await this.fileProvider.getFile(key, parentUrl);
        }
        else {
            // Relative keys resolve against the host page via fetch() — never do that.
            if (!checkIsAbsoluteUrl(url)) {
                throw new Error(`Cannot fetch relative file without fileProvider: ${url}`);
            }
            data = await this.httpClient.get(url, { responseType: "arraybuffer", timeout: 600000 });
        }
        const extension = getExtension(key) || "";
        let bytes: Uint8Array;
        if (this.fileDecrypter) {
            // data = this.runtime.fileDecryptCallback(new DecryptCallbackFile(extension, new Uint8Array(data), url)).buffer;
            const customKey = this.url instanceof FilePackage ? this.url.customKey : "";
            const callbackFile = new DecryptFile(extension, new Uint8Array(data), url)
            callbackFile.key = customKey;
            bytes = await this.fileDecrypter.decrypt(callbackFile);
        }
        else {
            bytes = new Uint8Array(data);
        }
        const mimetype = getMimetype(key);
        return { data: bytes, type: mimetype }
    }

    protected buildUrl(key: string, parentUrl: string): string {
        if (checkIsAbsoluteUrl(key)) {
            return key;
        }
        let docRoot = "";
        const lastSlashPosition = parentUrl?.lastIndexOf('/');
        if (lastSlashPosition > 0) {
            docRoot = parentUrl.substring(0, lastSlashPosition + 1);
        }
        const uri = getFullUrl(key, docRoot);
        if (checkIsAbsoluteUrl(docRoot)) {
            key = uri.toString();
        }
        else {
            key = uri.pathname + uri.search;
            key = key.substring(1);
        }
        return key;
    }

    async getNav(): Promise<Nav> {
        return this.nav;
    }

    async getSpineFile(url: string): Promise<SpineFile> {
        if (url == null) {
            return null;
        }
        const spineFiles = await this.getSpineFiles();

        const isNumericUrl = isNumber(url)
        if (isNumericUrl) {
            let index = parseInt(url);
            return spineFiles[index];
        }
        // const urlWithoutAnchor = getUrlFragment(url).urlWithoutAnchor;
        // return spineFiles.find(x => x.url == urlWithoutAnchor);

        const urlWithoutAnchor = getUrlFragment(url).urlWithoutAnchor;
        //         const fileName = getFileName(url)
        // // Cannot match by url or fileName alone: url may be absolute, relative, or with query params, and fileName may not be unique, so match separately
        // return spineFiles.find(x => x.url == urlWithoutAnchor || getFileName(x.url).toLowerCase() == fileName.toLowerCase());

        let spineFile = spineFiles.find(x => x.url == urlWithoutAnchor);
        if (spineFile) {
            return spineFile;
        }
        const fileName = getFileName(url)
        return spineFiles.find(x => getFileName(x.url).toLowerCase() == fileName.toLowerCase());
    }

    async getSpineFiles(): Promise<SpineFile[]> {
        return this.spineFiles;
    }

    async dispose(): Promise<void> {
        this.revokeOwnedBlobUrls();
        if (this.spineFiles) {
            this.spineFiles.splice(0)
        }
        this.nav = null;
        this.metadata = null;
        this.urlParseResult = null;
    }

    private revokeOwnedBlobUrls(): void {
        const urls = new Set<string>();
        if (this.urlParseResult?.mainUrl && checkIsBlobUrl(this.urlParseResult.mainUrl)) {
            urls.add(this.urlParseResult.mainUrl);
        }
        for (const spineFile of this.spineFiles ?? []) {
            if (spineFile?.url && checkIsBlobUrl(spineFile.url)) {
                urls.add(spineFile.url);
            }
        }
        for (const url of urls) {
            try {
                URL.revokeObjectURL(url);
            } catch {
                // ignore
            }
        }
    }
}