import { convertStringToUint8Array } from "../../common/encoding";
import { getExtension } from "../../common/path";
import { isNullOrWhiteSpace } from "../../common/text";
import { checkIsAbsoluteUrl, getFullUrl } from "../../common/url";
import { FileUrlParserOptions, IFileUrlParser, UrlParseResult } from "./IFileUrlParser";
import { IHttpClient } from "../../network/IHttpClient";
import { IInternalUrlBuilder } from "../internalUrlBuilder/IInternalUrlBuilder";
import { FilePackage, SpineFile } from "../../IFileParser";
import { ILocale } from "../../i18n/ILocale";

export class DefaultFileUrlParser implements IFileUrlParser {
    constructor(public readonly httpClient: IHttpClient, public readonly internalUrlBuilder: IInternalUrlBuilder, public readonly locale: ILocale) {

    }

    async parse(url: any, options?: FileUrlParserOptions) {
        const result = new UrlParseResult();
        if (url instanceof Array) {
            const multiUrls = url as Array<string>;
            if (multiUrls.length == 0) {
                throw new Error(this.locale.getText("fileparser_missingUrl", "url is required"));
            }
            for (let i = 0; i < multiUrls.length; i++) {
                const fullUrl = await this.formatUrl(multiUrls[i], options);
                const extension = getExtension(fullUrl) || options?.extension;
                if (isNullOrWhiteSpace(extension)) {
                    throw new Error('Missing extension')
                }
                result.spineFiles.push(new SpineFile(undefined, fullUrl, extension));
                result.isMultiFiles = true;
            }
            result.requireCalculateFileSymbolCount = true;
        } else if (url instanceof FilePackage) {
            const filePackage = url;
            result.metadata = filePackage.metadata;
            if (filePackage.nav) {
                result.nav = filePackage.nav;
            }
            if (filePackage.spineFiles && filePackage.spineFiles.length > 0) {
                result.spineFiles = filePackage.spineFiles;
                result.isMultiFiles = true;
            }
            else {
                options = Object.assign({}, filePackage, options);
                let parseResult = await this.parseBasicUrl(filePackage.fileUrl, options)
                result.data = parseResult.data;
                result.requireCalculateFileSymbolCount = parseResult.requireCalculateFileSymbolCount
                result.base = parseResult.base
                result.mainUrl = parseResult.mainUrl
            }
            result.requireSignUrl = filePackage.requireSignUrl;
        }
        else {
            let parseResult = await this.parseBasicUrl(url, options)
            result.data = parseResult.data;
            result.requireCalculateFileSymbolCount = parseResult.requireCalculateFileSymbolCount
            result.base = parseResult.base
            result.mainUrl = parseResult.mainUrl
            if (options?.metadata) {
                result.metadata = options.metadata;
            }
        }
        return result
    }

    protected async parseBasicUrl(url: any, options?: FileUrlParserOptions): Promise<{ mainUrl: string, data: ArrayBuffer, base: string, requireCalculateFileSymbolCount: boolean; }> {
        const changedParameters = await this.changeOpenParameters(url, options);
        url = changedParameters.url;
        options = changedParameters.options;
        let requireCalculateFileSymbolCount = false;
        let data: ArrayBuffer
        let base: string = "";
        let mainUrl: string = "";
        if (typeof url === "string") {
            let isSimpleUrl = checkIsAbsoluteUrl(url)
            if (!isSimpleUrl) {
                try {
                    JSON.parse(url)
                    isSimpleUrl = false
                }
                catch (e) {
                    isSimpleUrl = true;
                }
            }

            if (isSimpleUrl) {
                const lastSlashPosition = url.lastIndexOf('/');
                if (lastSlashPosition > 0) {
                    base = url.substring(0, lastSlashPosition + 1);
                }
                let fullUrl: string;
                if (url.startsWith("/")) {
                    fullUrl = url
                }
                else {
                    fullUrl = await this.formatUrl(url, options);
                }

                if (options?.requireDownload) {
                    if (checkIsAbsoluteUrl(fullUrl, true)) {
                        data = await this.getDataFromNetworkUrl(fullUrl, options);
                    }
                    else {
                        data = await this.getDataFromStringUrl(fullUrl, options);
                        if (!data || data.byteLength == 0) {
                            //尝试使用网络请求
                            data = await this.getDataFromNetworkUrl(fullUrl, options);
                        }
                    }
                }
                mainUrl = fullUrl;
            }
            else {
                data = convertStringToUint8Array(url).buffer as ArrayBuffer
                mainUrl = "";
            }

            requireCalculateFileSymbolCount = true;
        } else if (url instanceof ArrayBuffer) {
            data = url
            requireCalculateFileSymbolCount = true;
        } else if (url instanceof Uint8Array) {
            data = url.buffer as ArrayBuffer;
            requireCalculateFileSymbolCount = true;
        } else if (url instanceof Blob) {
            data = await this.readBlobAsArrayBuffer(url, options);
            requireCalculateFileSymbolCount = true;
        } else if (globalThis.FileSystemFileHandle && url instanceof globalThis.FileSystemFileHandle) {
            const file = await url.getFile();
            data = await this.readBlobAsArrayBuffer(file, options);
            requireCalculateFileSymbolCount = true;
        }
        else {
            throw new Error(this.locale.getText("fileparser_unknownUrl", "unknown url format"));
        }
        return { mainUrl, data, base, requireCalculateFileSymbolCount };
    }

    protected async changeOpenParameters(url: any, options?: FileUrlParserOptions): Promise<{ url: string, options?: FileUrlParserOptions }> {
        return { url, options };
    }

    private async readBlobAsArrayBuffer(blob: Blob, options?: FileUrlParserOptions): Promise<ArrayBuffer> {
        if (!options?.fileDownloadingCallback) {
            return await blob.arrayBuffer();
        }
        return new Promise<ArrayBuffer>((resolve, reject) => {
            const reader = new FileReader();
            reader.onprogress = (e) => {
                if (e.lengthComputable) {
                    options.fileDownloadingCallback(e.total, e.loaded, false);
                }
            };

            reader.onload = (e) => {
                options.fileDownloadingCallback(e.total, e.total, true);
                resolve((e.target as FileReader).result as ArrayBuffer);
            };

            reader.onerror = (e) => {
                reject(e);
            };

            reader.abort = () => {
                reject('aborted');
            };
            reader.readAsArrayBuffer(blob);
        });
    }

    protected async getDataFromNetworkUrl(url: string, options?: FileUrlParserOptions): Promise<ArrayBuffer> {
        const headers = {}
        if (options?.authorizationKey && options?.authorizationValue) {
            headers[options?.authorizationKey] = options?.authorizationValue
        }
        const data = await this.httpClient.get(url, {
            responseType: "arraybuffer",
            timeout: 600000,
            contentLength: options?.fileSize,
            headers: headers,
            requireCORSProxy: options?.requireCORSProxy,
            downloadProgressCallback: options?.fileDownloadingCallback,
            abortController: options?.abortController
        });

        return data;
    }

    protected async getDataFromStringUrl(url: string, options?: FileUrlParserOptions): Promise<ArrayBuffer> {
        return await this.getDataFromNetworkUrl(url, options);
    }

    private async formatUrl(url: string, options?: FileUrlParserOptions): Promise<string> {
        // return getFullUrl(url, window.location.href).toString();
        return this.internalUrlBuilder ? await this.internalUrlBuilder.getAbsoluteUrl(url, true) : getFullUrl(url, globalThis.location.href).toString();
    }
}