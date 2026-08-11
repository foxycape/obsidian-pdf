import { computeUniqueId, getUuid } from "./common/uuid";

/** resolve script src: resolve the current module/script URL, used to concatenate built-in resource paths */
const resolveScriptSrc = (): string => {
    if (typeof import.meta !== "undefined" && import.meta.url) {
        return import.meta.url;
    }
    if (typeof document !== "undefined") {
        return (document.currentScript as HTMLScriptElement | null)?.src ?? "";
    }
    return "";
};

const resolveReaderBase = (src: string): { baseUrl: string; preventCacheHash: string } => {
    if (!src) {
        return { baseUrl: "", preventCacheHash: getUuid() };
    }
    try {
        const url = new URL(src);
        const search = url.search;
        return {
            baseUrl: new URL(".", url).href,
            preventCacheHash: search ? computeUniqueId(search) : getUuid(),
        };
    } catch {
        const lastSlashPosition = src.lastIndexOf("/");
        const lastQuestionMarkPosition = src.lastIndexOf("?");
        return {
            baseUrl: lastSlashPosition >= 0 ? src.substring(0, lastSlashPosition + 1) : "",
            preventCacheHash: lastQuestionMarkPosition > 0
                ? computeUniqueId(src.substring(lastQuestionMarkPosition))
                : getUuid(),
        };
    }
};

const { baseUrl: readerBaseUrl, preventCacheHash: readerPreventCacheHash } = resolveReaderBase(resolveScriptSrc());
export class ReaderInfo {
    readonly baseUrl: string;
    readonly preventCacheHash: string;
    readonly version: string;
    readonly debug: boolean;

    constructor(version: string, baseUrl: string, preventCacheHash: string, debug: boolean) {
        this.baseUrl = baseUrl || readerBaseUrl;
        this.preventCacheHash = preventCacheHash || readerPreventCacheHash;
        this.version = version;
        this.debug = debug;
    }
}

