import { deepClone } from "../common/object";
import { getExtension } from "../common/path";
import { isNullOrWhiteSpace } from "../common/text";
import { checkIsHttpUrl } from "../common/url";
import { getUuid } from "../common/uuid";
import { computeSimpleId } from "../crypto/MD5";
import { getDocumentBody } from "../html/finder";
import { FilePackage } from "../IFileParser";
import { OpenOptions } from "../OpenOptions";
import { Options } from "../Options";
import { FileLocation } from "../progress/Progress";
import { CoreServiceMap, ServiceCollection } from "../services/ServiceCollection";

export class InputFormatter {
    constructor(private readonly services: ServiceCollection<CoreServiceMap>, private readonly options: Options) {
    }

    private formatOpenOptions(openOptions: OpenOptions): OpenOptions {
        let options = Object.assign(new OpenOptions, openOptions);
        if (!options) {
            options = new OpenOptions();
        }
        //Remove keys that are null or undefined
        Object.keys(options).forEach((key) => {
            if (options[key] === null || options[key] === undefined || options[key] === '') {
                delete options[key];
            }
        });
        return options;
    }

    /**
     * get open url if input url is not valid or undefined
     * @param url url to open
     * @param openOptions options for the open
     * @returns the url string | ArrayBuffer | FilePackage | Blob | FileSystemFileHandle | undefined
     */
    private async getOpenUrl(url: any, openOptions: OpenOptions): Promise<any> {
        let result = url;
        if (!this.isValidFileUrl(url)) {
            const fileUrlProvider = await this.services.get("fileUrlProvider", false);
            if (!fileUrlProvider) {
                return undefined;
            }
            result = await fileUrlProvider.getUrl(openOptions);
        }
        return this.formatUrl(result);
    }

    async formatInputParameters(url: any, openOptions: OpenOptions): Promise<{ url: any, openOptions: OpenOptions, extension: string }> {
        const currentUrl = await this.getOpenUrl(url, openOptions);
        const currentOpenOptions = this.formatOpenOptions(openOptions);
        const currentExtension = this.formatExtension(currentUrl, currentOpenOptions.extension);
        return { url: currentUrl, openOptions: currentOpenOptions, extension: currentExtension };
    }

    guardUrl(url: any) {
        if (!this.isValidFileUrl(url)) {
            const fileUrlProvider = this.services.has("fileUrlProvider");
            if (!fileUrlProvider) {
                throw new Error("FileUrlProvider is not registered");
            }
        }
    }

    private formatUrl(url: any): any {
        if (this.isFilePackageLike(url) && !(url instanceof FilePackage)) {
            url = Object.assign(new FilePackage(), url);
        }
        return url;
    }

    private isFilePackageLike = (value: unknown): value is Record<string, unknown> => {
        if (value == null || typeof value !== "object") return false;
        if (value instanceof FilePackage) return true;
        if (
            Array.isArray(value) ||
            value instanceof ArrayBuffer ||
            value instanceof Uint8Array ||
            value instanceof Blob ||
            (typeof FileSystemFileHandle !== "undefined" && value instanceof FileSystemFileHandle)
        ) {
            return false;
        }
        return "fileUrl" in value || "spineFiles" in value;
    };


    private isValidFileUrl(url: any): boolean {
        if (!url)
            return false;
        if (typeof url === "string" ||
            url instanceof Array ||
            url instanceof FilePackage ||
            url instanceof ArrayBuffer ||
            url instanceof Uint8Array ||
            url instanceof Blob ||
            (globalThis.FileSystemFileHandle && url instanceof FileSystemFileHandle)) {
            return true;
        }
        // Plain object with no keys is invalid; binary sources above may also have no enumerable keys.
        if (typeof url == 'object' && Object.keys(url).length == 0)
            return false;
        return false;
    }

    formatReaderWrapper(container: string | HTMLElement): HTMLElement {
        let readerWrapper = undefined;
        if (typeof container === 'string') {
            readerWrapper = document.querySelector(container);
        }
        else {
            readerWrapper = container;
        }
        if (readerWrapper instanceof readerWrapper.ownerDocument.defaultView.window.HTMLHtmlElement) {
            readerWrapper = getDocumentBody(readerWrapper.ownerDocument);
        }
        readerWrapper.style.overflow = "hidden";
        readerWrapper.style.position = "relative";
        return readerWrapper;
    }

    private formatExtension(currentUrl: any, openExtension?: string): string {
        let extension = openExtension ?? "";
        if (isNullOrWhiteSpace(extension)) {
            if (typeof currentUrl === "string") {
                extension = getExtension(currentUrl) ?? "";
            }
            else if (currentUrl instanceof Array) {
                const multiUrls = currentUrl as Array<string>;
                if (multiUrls.length == 0) {
                    throw new Error('multiUrls is required');
                }
                extension = getExtension(multiUrls[0]) ?? "";
            }
            else if (currentUrl instanceof FilePackage) {
                if (!isNullOrWhiteSpace(currentUrl.extension)) {
                    extension = currentUrl.extension;
                }
                else if (!isNullOrWhiteSpace(currentUrl.fileUrl) && typeof currentUrl.fileUrl == "string") {
                    extension = getExtension(currentUrl.fileUrl)
                }
            }
            else if (globalThis.FileSystemFileHandle && currentUrl instanceof FileSystemFileHandle) {
                extension = getExtension(currentUrl.name);
            }
        }
        if (!extension.startsWith(".")) {
            extension = "." + extension;
        }
        return extension?.toLowerCase();
    }

    getIds = async (url: any, openOptions: OpenOptions) => {
        let resourceId = openOptions?.resourceId ?? "";
        let simpleId = openOptions?.simpleId ?? "";
        if (!resourceId && url instanceof FilePackage) {
            resourceId = url.resourceId;
        }
        if (!simpleId && url instanceof FilePackage) {
            simpleId = url.simpleId;
        }
        if (resourceId) {
            if (!simpleId) {
                simpleId = resourceId;
            }
            return { simpleId, resourceId, isExternalId: true };
        }

        if (isNullOrWhiteSpace(simpleId)) {
            if (typeof url === "string" ||
                url instanceof ArrayBuffer
                || url instanceof Uint8Array
                || url instanceof Blob
                || (globalThis.FileSystemFileHandle && url instanceof FileSystemFileHandle)) {
                simpleId = await computeSimpleId(url);
            } else if (url instanceof FilePackage) {
                if (url.fileUrl) {
                    simpleId = await computeSimpleId(url.fileUrl);
                }
                else {
                    throw new Error('Missing resourceId')
                }
            }
            else {
                simpleId = getUuid();
            }
        }
        return { simpleId, resourceId, isExternalId: false };
    }

    formatLocation = (inputLocation: FileLocation | number | string, extension: string) => {
        let location: FileLocation = undefined;
        let percentage: number = undefined;
        if (!inputLocation) {
            return { location, percentage }
        }

        if (inputLocation instanceof FileLocation) {
            location = inputLocation;
        }
        else if (Object.prototype.toString.call(inputLocation) === '[object Object]') {
            const l = JSON.parse(JSON.stringify(inputLocation));
            if (l["url"]) {
                return { location: deepClone<FileLocation>(l), percentage };
            }
        }
        else if (typeof inputLocation === "number") {
            //Total progress ratio
            if (!isNaN(percentage) && percentage <= 1 && percentage >= 0)
                percentage = inputLocation;
        }
        else if (typeof inputLocation === "string" && !isNullOrWhiteSpace(inputLocation)) {
            let parseLocationSuccess = false
            if (inputLocation.trim().indexOf("{") >= 0) {
                try {
                    location = JSON.parse(inputLocation.trim())
                    parseLocationSuccess = true
                }
                catch (e) {
                    parseLocationSuccess = false;
                }
            }
            if (!parseLocationSuccess) {
                const locationArray = inputLocation.split(/[-_]/);
                if (locationArray.length == 1) {
                    //Total progress ratio
                    const pageOrPercentage = parseFloat(inputLocation);
                    if (!isNaN(pageOrPercentage) && pageOrPercentage <= 1 && pageOrPercentage >= 0) {
                        percentage = pageOrPercentage;
                    }
                    else if (!isNaN(pageOrPercentage) && extension === ".pdf") {
                        location = new FileLocation("", 1, 'page');
                        location.current = pageOrPercentage;
                    }
                }
                else if (locationArray.length == 2) {
                    // There are several cases here
                    // url-progress
                    // url index value-progress
                    // url-progress calculation symbol@progress
                    // url index value-progress calculation symbol@progress
                    location = new FileLocation(locationArray[0], 1, 'ratio');
                    let current = parseFloat(locationArray[1]);
                    if (isNaN(current)) {
                        //Here is a special handling, compatible with the progress and calculation symbol format
                        const symbolTypeWithCurrent = locationArray[1].split("@");
                        if (symbolTypeWithCurrent.length > 1) {
                            const symbolType = symbolTypeWithCurrent[0].toLowerCase();
                            if (symbolType == "char") {
                                location.symbolType = symbolType;
                            }
                            else {
                                location.symbolType = "custom";
                            }

                            current = parseFloat(symbolTypeWithCurrent[1]);
                            if (isNaN(current) || current < 0) {
                                location.current = 0;
                            }
                            else {
                                location.current = current;
                            }
                        }
                        else {
                            location.current = 0;
                        }
                    }
                    else {
                        location.current = current < 0 ? 0 : current;
                    }
                }
                else if (locationArray.length == 3) {
                    location = new FileLocation(locationArray[0], 1, 'ratio');
                    location.tagName = locationArray[1];
                    const tagIndex = parseInt(locationArray[2]);
                    if (isNaN(tagIndex) || tagIndex < 0) {
                        location.tagIndex = 0;
                    }
                    else {
                        location.tagIndex = tagIndex;
                    }
                }
            }
        }
        return { location, percentage }
    }

    formatParserUrl(url: any, extension: string, openOptions: OpenOptions): { url: any, abortController: AbortController } {
        let parserUrl: any;
        if (url instanceof FilePackage) {
            parserUrl = url;
        }
        else if (!(url instanceof Array)) {
            parserUrl = new FilePackage();
            parserUrl.fileUrl = url;
            parserUrl.extension = extension;
        }
        else {
            parserUrl = url;
        }
        parserUrl = Object.assign(parserUrl, openOptions);
        let abortController: AbortController = undefined;
        if (typeof url === "string" || (url?.fileUrl && typeof url.fileUrl === "string" && checkIsHttpUrl(url.fileUrl))) {
            abortController = new AbortController();
            parserUrl.abortController = abortController;
        }
        return { url: parserUrl, abortController: abortController };
    }
}