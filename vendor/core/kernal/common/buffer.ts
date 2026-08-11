export const str2ab = (str: string) => {
    const buf = new ArrayBuffer(str.length);
    const bufView = new Uint8Array(buf);
    for (let i = 0, strLen = str.length; i < strLen; i++) {
        bufView[i] = str.charCodeAt(i);
    }
    return buf;
};

export const convertBase64ToArrayBuffer = (base64: string) => {
    const binaryDerString = globalThis.atob(base64);
    return str2ab(binaryDerString);
};

export const toSafeUint8Array = (data: ArrayBuffer | Uint8Array): Uint8Array<ArrayBuffer> => {
    if (data instanceof ArrayBuffer) {
        return new Uint8Array(data);
    }

    if (isSharedArrayBuffer(data.buffer as any)) {
        const copy = new Uint8Array(data.length);
        copy.set(data);
        return copy;
    }

    return data as Uint8Array<ArrayBuffer>;
};

export const isSharedArrayBuffer = (buffer: ArrayBuffer): boolean => {
    return Object.prototype.toString.call(buffer) === '[object SharedArrayBuffer]';
};

export const toBlob = (data: Uint8Array | ArrayBuffer, options?: BlobPropertyBag) => {
    const buffer = toSafeUint8Array(data);
    return new Blob([buffer], options);
};

export const convertBufferToDataUrl = (data: Uint8Array | ArrayBuffer | Blob, options?: BlobPropertyBag) => {
    let blob: Blob;
    if (data instanceof ArrayBuffer) {
        blob = toBlob(data, options);
    } else if (data instanceof Uint8Array) {
        blob = toBlob(data, options);
    }
    else {
        blob = data;
    }
    return new Promise<string>((resolve, reject) => {
        try {
            const reader = new FileReader()
            reader.onload = function (event) {
                resolve(event.target.result as string)
            }
            reader.readAsDataURL(blob)
        }
        catch (ex) {
            reject(ex)
        }
    })
};

export const convertArrayBufferToBase64 = async (data: Uint8Array | ArrayBuffer | Blob, keepHeader?: boolean, options?: BlobPropertyBag) => {
    const base64String = await convertBufferToDataUrl(data, options);
    return keepHeader ? base64String : base64String.split(',')[1]
};
