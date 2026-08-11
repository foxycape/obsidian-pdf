import { appendUrlParameter, checkIsAbsoluteUrl } from "../../common/url";
import { IInternalUrlBuilder } from "./IInternalUrlBuilder";

export class DefaultInternalUrlBuilder implements IInternalUrlBuilder {
    private baseUrl: string;
    private preventCacheHash: string;
    private internalUrlCallback?: (readerBaseUrl: string, relativeUrl: string, hash: string) => Promise<string>
    /**
     * Constructor
     * @param baseUrl
     * @param preventCacheHash
     * @param internalUrlCallback Optional post-processing callback (e.g. signing for file access)
     */
    constructor(baseUrl: string, preventCacheHash: string, internalUrlCallback?: (readerBaseUrl: string, relativeUrl: string, hash: string) => Promise<string>) {
        this.baseUrl = baseUrl;
        if (this.baseUrl && !this.baseUrl.endsWith("/")) {
            this.baseUrl = this.baseUrl + "/";
        }
        this.preventCacheHash = preventCacheHash;
        this.internalUrlCallback = internalUrlCallback;
    }
    async getAbsoluteUrl(relativeUrl: string, ignoreHash?: boolean): Promise<string> {
        if (!relativeUrl)
            return "";

        if (checkIsAbsoluteUrl(relativeUrl)) {
            return relativeUrl;
        }
        // Do not strip a leading slash: it denotes a path from the root.
        // if (startsWithAny(relativeUrl, true, "/")) {
        //     relativeUrl = relativeUrl.substring(1);
        // }
        let url: string;
        if (this.internalUrlCallback) {
            if (ignoreHash) {
                url = await this.internalUrlCallback(this.baseUrl, relativeUrl, "");
            }
            else {
                url = await this.internalUrlCallback(this.baseUrl, relativeUrl, this.preventCacheHash);
            }
        }
        else {
            if (this.baseUrl) {
                url = new URL(relativeUrl, this.baseUrl).toString()
            }
            else {
                url = relativeUrl
            }

            if (!ignoreHash && this.preventCacheHash) {
                url = appendUrlParameter(url, "_preventCacheHash", this.preventCacheHash);
            }
        }

        return url;
    }
}