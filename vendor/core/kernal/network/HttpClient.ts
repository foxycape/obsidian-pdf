import { HttpClientOptions, IHttpClient, ResponseType } from "./IHttpClient";
import { isNumber } from "../common/number";
export class HttpClient implements IHttpClient {
    async get(url: string, options?: HttpClientOptions): Promise<any> {

        let config: HttpClientOptions = {};

        if (options) {
            config = Object.assign({}, config, options);
        }

        if (!config.responseType) {
            config.responseType = "text";
        }
        const originResponseType = config.responseType
        if (options?.downloadProgressCallback) {
            if (config.responseType == "arraybuffer" || config.responseType == "blob" || config.responseType == "stream") {
                config.responseType = "stream"
            }
        }
        const request: RequestInit = {};
        if (options?.headers) {
            request.headers = options.headers;
        }
        request.method = "get"
        if (options?.abortController) {
            request.signal = options.abortController.signal;
        }
        const response = await fetch(url, request)
        if (!response.ok) {
            if (response.status == 404) {
                throw new Error(`File not found! status: ${response.status}`);
            }
            if (response.status == 403) {
                throw new Error(`Forbidden! status: ${response.status}`);
            }
            if (response.status == 401) {
                throw new Error(`Unauthorized! status: ${response.status}`);
            }
            const text = await response.text();
            throw new Error(`HTTP error! status: ${response.status},message: ${text}`);
        }
        const isStream = options?.responseType == "arraybuffer" || options?.responseType == "blob" || options?.responseType == "stream";
        if (options?.downloadProgressCallback && isStream) {
            const reader = response?.body?.getReader();
            if (reader) {
                const headerContentLength = response.headers.get('Content-Length');
                let contentLength = headerContentLength ? parseInt(headerContentLength) : options?.contentLength;
                if (isNumber(contentLength)) {
                    contentLength = parseInt(contentLength.toString());
                }
                let receivedLength = 0;
                let chunks = [];
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        options.downloadProgressCallback(contentLength, receivedLength, done);
                        break;
                    }
                    chunks.push(value);
                    receivedLength += value.length;
                    //@ts-ignore
                    options.downloadProgressCallback(contentLength, receivedLength, done);
                }
                let chunksAll = new Uint8Array(receivedLength);
                let position = 0;
                for (let chunk of chunks) {
                    chunksAll.set(chunk, position);
                    position += chunk.length;
                }
                if (originResponseType == "arraybuffer" || options?.responseType == 'arraybuffer') {
                    return chunksAll.buffer;
                }
                else if (originResponseType == "blob") {
                    return new Blob([chunksAll])
                }
                return chunksAll.buffer;
            }
        }
        return await this.response(response, options?.responseType)
    }

    async response(response: Response, responseType: ResponseType) {
        if (responseType == "json") {
            try {
                return await response.json();
            } catch (e) {
                return {};
            }
        } else if (responseType == "arraybuffer") {
            return await response.arrayBuffer();
        } else if (responseType == "blob") {
            return await response.blob();
        } else if (responseType == "stream") {
            return await response.blob();
        }
        // Return text
        const text = await response.text();
        try {
            // Try to parse as JSON
            return JSON.parse(text);
        } catch (e) {
            return text;
        }
    }

    async post(url: string, data: any | FormData, options?: HttpClientOptions): Promise<any> {
        const request: RequestInit = {};
        request.headers = options?.headers ? options?.headers : {};
        let postData = data;
        if (typeof data === "string") {
            const keyValues = new URLSearchParams(data);
            if (keyValues.size > 0) {
                postData = new FormData();
                for (const [key, value] of keyValues.entries()) {
                    postData.append(key, value);
                }
            }
        }
        else {
            if (data && typeof data === 'object' && typeof data.append !== 'function' && typeof data.text !== 'function') {
                if (options?.requestBodyType == 'raw') {
                    postData = JSON.stringify(data);
                    let foundJsonType = false;
                    for (const [key, value] of Object.entries(request.headers)) {
                        if (key.toLowerCase() == 'content-type') {
                            request.headers[key] = 'application/json';
                            foundJsonType = true;
                            break;
                        }
                    }
                    if (!foundJsonType) {
                        request.headers['Content-Type'] = 'application/json';
                    }
                }
                else {
                    const keys = Object.keys(data);
                    if (keys.length > 0) {
                        postData = new FormData();
                        for (const key of keys) {
                            postData.append(key, data[key]);
                        }
                    }
                }
            }
        }
        request.method = "post"
        if (options?.abortController) {
            request.signal = options.abortController.signal;
        }
        // FormData requires fetch to set the multipart boundary automatically; keeping Content-Type manually prevents the server from parsing form fields
        if (postData && typeof postData === 'object' && typeof postData.append === 'function') {
            for (const key of Object.keys(request.headers)) {
                if (key.toLowerCase() === 'content-type') {
                    delete request.headers[key];
                }
            }
        }
        request.body = postData
        const response = await fetch(url, request)
        if (!response.ok) {
            if (response.status == 404) {
                throw new Error(`File not found! status: ${response.status}`);
            }
            if (response.status == 403) {
                throw new Error(`Forbidden! status: ${response.status}`);
            }
            if (response.status == 401) {
                throw new Error(`Unauthorized! status: ${response.status}`);
            }
            const text = await response.text();
            throw new Error(`HTTP error! status: ${response.status},message: ${text}`);
        }
        return await this.response(response, options?.responseType)
    }

    async getConfig<T>(urls: string[], defaultValue: T, responseType?: ResponseType) {
        if (!urls || urls.length == 0)
            return {};
        if (!responseType) {
            responseType = "json"
        }
        const datas: T[] = [];
        const promises: Promise<any>[] = [];
        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            try {
                const p = this.get(url, { responseType: responseType });
                promises.push(p);
            } catch (err) {
                console.log(err);
            }
        }

        let dataIsArray = false;
        for (let i = 0; i < promises.length; i++) {
            try {
                const data = await promises[i];
                if (data) {
                    if (!dataIsArray) {
                        dataIsArray = this.isArray(data);
                    }
                    datas.push(data);
                }
            } catch (err) {
                console.log(err);
            }
        }
        if (datas.length == 0)
            return defaultValue;

        if (defaultValue) {
            const options = Object.assign(defaultValue as any, ...datas);
            return options;
        }
        else {
            if (dataIsArray) {
                const options = Object.assign([], ...datas);
                return options;
            }
            else {
                const options = Object.assign({}, ...datas);
                return options;
            }
        }
    }

    private isArray<T extends any[]>(value: T | unknown): value is T {
        return Object.prototype.toString.call(value) === '[object Array]'
    }
    
}