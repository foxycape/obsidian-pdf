import { isNullOrWhiteSpace, startsWith, startsWithAny } from "./text";

export const baseHolderUrl = "https://a.com/";

/**
 * Absolute URL fallback for environments without URL.canParse.
 * Accepts hierarchical (`scheme://...`) and common opaque schemes (`blob:`, `data:`, ...).
 * Rejects Windows paths like `C:/foo` (single-letter scheme + path separator).
 */
const ABSOLUTE_URL_FALLBACK_RE =
    /^(?:[a-z][a-z0-9+.-]*:\/\/\S+|(?:blob|data|mailto|about|javascript|filesystem):)/i;

const isWindowsDrivePath = (url: string) => /^[a-zA-Z]:[\\/]/.test(url);

const isBareScheme = (url: string) => /^[a-z][a-z0-9+.-]*:$/i.test(url);

const internalCheckIsAbsoluteUrl = (url: string): boolean => {
    if ("canParse" in URL) {
        if (!(URL as typeof URL & { canParse(url: string): boolean }).canParse(url)) {
            return false;
        }
        // URL.canParse treats "C:/foo" as absolute (scheme "c:"); that is not useful here.
        if (isWindowsDrivePath(url) || isBareScheme(url)) {
            return false;
        }
        return true;
    }
    return ABSOLUTE_URL_FALLBACK_RE.test(url);
};

/**
 * Return the absolute URL
 */
export const getFullUrl = (url: string, base: string = baseHolderUrl): URL => {
    if (checkIsAbsoluteUrl(url)) {
        const fullUrl = new URL(url);
        return fullUrl;
    }
    else {
        if (isNullOrWhiteSpace(base)) {
            base = baseHolderUrl;
        }
        else if (!(checkIsAbsoluteUrl(base))) {
            base = baseHolderUrl + base;
        }

        const fullUrl = new URL(url, base);
        return fullUrl;
    }
};

/**
 * Get the absolute directory path of a URL
 */
export const getAbsoluteDir = (url: string) => {
    const uri = getFullUrl(url);
    let base = "/";
    if (uri.pathname.endsWith("/")) {
        base = uri.pathname;
    }
    else {
        const lastSplashPosition = uri.pathname.lastIndexOf("/");
        if (lastSplashPosition > 0) {
            base = uri.pathname.substring(0, lastSplashPosition)
        }
    }
    return base;
};

export const getCurrentBaseUrl = () => {
    if (typeof location !== 'undefined' && location.protocol && location.host) {
        return `${location.protocol}//${location.host}`;
    }
    throw new Error('getCurrentBaseUrl is not available in this context');
};

export const getBaseUrl = (url: string) => {
    const uri = getFullUrl(url);
    return uri.protocol + "//" + uri.host;
};

export const getUrl = (url: string, base?: string, options?: { removeBase?: boolean, removeQuery?: boolean, removeHash?: boolean }) => {
    let fullUrl: URL;
    if (checkIsAbsoluteUrl(url)) {
        fullUrl = getFullUrl(url)
    }
    else {
        fullUrl = getFullUrl(url, base);
    }
    let path = fullUrl.pathname;
    if (!(startsWith(fullUrl.toString(), baseHolderUrl))) {
        if (!options?.removeBase) {
            if (fullUrl.origin) {
                path = fullUrl.origin + path;
            }
        }
    }
    if (!options?.removeQuery) {
        path = path + fullUrl.search;
    }
    if (!options?.removeHash) {
        path = path + fullUrl.hash;
    }
    if (startsWithAny(path, false, "/", "\\")) {
        path = path.replace(/[\\]+/gi, "/").substring(1);
    }
    return path;
};

export const appendUrlParameter = (url: string, name: string, value: any) => {
    if (!url) {
        return url;
    }
    return updateUrlParameter(url, name, value);
};

export const appendUrlParameters = (url: string, nameValues: Map<string, any> | object) => {
    if (!url) {
        return url;
    }
    return updateUrlParameters(url, nameValues);
};

export const getParameterValue = (url: URL | string | URLSearchParams, key: string) => {
    if (isNullOrWhiteSpace(key))
        return null;
    let params: URLSearchParams;
    if (url instanceof URL) {
        params = url.searchParams;
    }
    else if (url instanceof URLSearchParams) {
        params = url
    }
    else {
        params = getFullUrl(url).searchParams;
    }
    const lowercaseKey = key.toLowerCase();
    const keys = Array.from(params.keys());
    let actualKey: string = null;
    for (let i = 0; i < keys.length; i++) {
        if (keys[i].toLowerCase() == lowercaseKey) {
            actualKey = keys[i];
            break;
        }
    }
    if (isNullOrWhiteSpace(actualKey)) {
        return '';
    }
    const value = params.get(actualKey);
    if (isNullOrWhiteSpace(value)) {
        return '';
    }
    return value;
};

export const updateUrlParameter = (url: string, name: string, value: any) => {
    const nameValues = new Map<string, any>();
    nameValues.set(name, value);
    return updateUrlParameters(url, nameValues)
};

export const updateUrlParameters = (url: string, nameValues: Map<string, any> | object) => {
    if (isNullOrWhiteSpace(url))
        return url;

    if (!checkIsAbsoluteUrl(url))
        return url;

    if (!nameValues)
        return url;

    const fullUrl = new URL(url);
    let newUrl = fullUrl.origin + fullUrl.pathname;
    if (nameValues instanceof Map) {
        nameValues.forEach((value, key) => {
            fullUrl.searchParams.set(key, value);
        })
    }
    else {
        const keys = Object.keys(nameValues)
        keys.forEach((key) => {
            fullUrl.searchParams.set(key, nameValues[key]);
        })
    }

    const searches: string[] = [];
    fullUrl.searchParams.forEach((value, key) => {
        searches.push(key + "=" + encodeURIComponent(value));
    })
    newUrl += "?" + searches.join("&") + fullUrl.hash;
    return newUrl;
};

export const stringifyParamters = (parameters: Object) => {
    const encodedData: string[] = [];
    const keys = Object.keys(parameters);
    for (let i = 0; i < keys.length; i++) {
        encodedData.push(keys[i] + "=" + encodeURIComponent(parameters[keys[i]]));
    }
    const query = encodedData.join("&");
    return query;
};

export const combineUrlSegments = (...segments: string[]) => {
    let path: string = "";
    if (segments.length == 0)
        throw new Error("segments is empty");
    const segmentCount = segments.length;
    for (let i = 0; i < segmentCount; i++) {
        let segment = segments[i];
        if (isNullOrWhiteSpace(segment))
            continue;
        if (segment.indexOf("/") == 0 || segment.indexOf("\\") == 0) {
            segment = segment.substring(1);
        }
        if (i != segmentCount - 1 && segment.charAt(segment.length - 1) != "/") {
            segment = segment + "/";
        }
        path = path + segment;
    }
    const url = new URL(path, baseHolderUrl);
    if (url.href.indexOf(baseHolderUrl) == 0) {
        let relativeUrl = url.pathname + url.search + url.hash;
        if (relativeUrl.indexOf("/") == 0)
            relativeUrl = relativeUrl.substring(1);
        return relativeUrl;
    }
    return url.href;
};

export const getUrlFragment = (url: string): { urlWithoutAnchor: string, anchor: string } => {
    const fragment = { urlWithoutAnchor: null, anchor: null };
    if (isNullOrWhiteSpace(url)) {
        return fragment;
    }
    fragment.urlWithoutAnchor = url;
    const anchorPosision = url.lastIndexOf("#");
    if (anchorPosision >= 0 && url.length > 1) {
        fragment.urlWithoutAnchor = url.substring(0, anchorPosision);
        fragment.anchor = url.substring(anchorPosision + 1);
    }
    return fragment;
};

/**
 * Whether the string is an absolute URL (has a URI scheme).
 * Includes http(s), blob, data, file, etc. Does not treat Windows paths as absolute.
 *
 * @param httpOnly When true, only `http://` / `https://` count as absolute.
 *   (Historically named `excludeLocal`; that name was misleading.)
 */
export const checkIsAbsoluteUrl = (url: string, httpOnly?: boolean): boolean => {
    if (!url || typeof url !== "string") {
        return false;
    }
    if (httpOnly) {
        return checkIsHttpUrl(url);
    }
    return internalCheckIsAbsoluteUrl(url);
};

/** Whether the string is an `http://` or `https://` URL. */
export const checkIsHttpUrl = (url: string): boolean => {
    if (!url || typeof url !== "string") {
        return false;
    }
    if (!startsWithAny(url, true, "http://", "https://")) {
        return false;
    }
    return internalCheckIsAbsoluteUrl(url);
};

export const checkIsBlobUrl = (url: string) => {
    if (!url || typeof url !== "string") {
        return false;
    }
    return startsWith(url, "blob:", true);
};

export const checkIsFileUrl = (url: string) => {
    if (!url || typeof url !== "string") {
        return false;
    }
    return startsWith(url, "file:", true);
};
