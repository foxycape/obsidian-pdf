const utf8ArrayToString = (data: Uint8Array): string => {
    let out: string, i: number, c: number;
    let char2: number, char3: number;

    out = "";
    const len = data.length;
    i = 0;
    while (i < len) {
        c = data[i++];
        switch (c >> 4) {
            case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
                out += String.fromCharCode(c);
                break;
            case 12: case 13:
                char2 = data[i++];
                out += String.fromCharCode(((c & 0x1F) << 6) | (char2 & 0x3F));
                break;
            case 14:
                char2 = data[i++];
                char3 = data[i++];
                out += String.fromCharCode(((c & 0x0F) << 12) |
                    ((char2 & 0x3F) << 6) |
                    ((char3 & 0x3F) << 0));
                break;
        }
    }

    return out;
};

/**
 * Remove BOM header
 */
export const removeBomHeader = (content: string) => {
    return content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content;
};

export const convertUint8ArrayToString = (data: Uint8Array): string => {
    let content: string;
    if (globalThis.TextDecoder) {
        content = new TextDecoder("utf-8").decode(data);
    }
    else {
        content = utf8ArrayToString(data);
    }

    content = removeBomHeader(content);
    return content;
};

export const convertArrayBufferToString = (data: ArrayBuffer): string => {
    return convertUint8ArrayToString(new Uint8Array(data));
};

export const convertStringToUint8Array = (data: string): Uint8Array => {
    return new TextEncoder().encode(data);
};

/**
 * Decode text using the given encoding (typically UTF-8)
 */
export const getUtf8Text = (source: ArrayBuffer, encoding: string) => {
    return new TextDecoder(encoding).decode(source)
};
