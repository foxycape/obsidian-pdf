import { BrowserCapabilities } from "../web/BrowserCapabilities";
import { SimpleMatrix } from "../shape/SimpleMatrix";
import { compareTagName } from "./finder";
import { getDocumentBody } from "./finder";

const offscreenLoadImage = async (requestImageUrl: string) => {
    try {
        const img = new Image();
        if (img.decode) {
            img.src = requestImageUrl;
            await img.decode();
            return { width: img.width, height: img.height, img: img };
        }
    }
    catch (e) {
        console.error('offscreenLoadImage', e)
    }

    return await new Promise<{ width: number, height: number, img: HTMLImageElement }>((resolve, reject) => {
        const img = new Image();
        img.src = requestImageUrl;

        if (img.complete) {
            resolve({ width: img.width, height: img.height, img: img });
        } else {
            setTimeout(() => {
                if (img.width > 0 && img.height > 0) {
                    resolve({ width: img.width, height: img.height, img: img });
                }
                else {
                    reject("timeout");
                }
            }, 2000);
            img.addEventListener("error", (err) => {
                reject(err);
            }, false);

            img.addEventListener("abort", (err) => {
                reject("about:" + err);
            }, false);

            img.addEventListener("load", () => {
                resolve({ width: img.width, height: img.height, img: img });
            }, false);
        }
    })
};

export const getBlob = async (image: ImageBitmapSource | string, matrix?: SimpleMatrix, maxSize?: number) => {
    let newImage: ImageBitmap | HTMLCanvasElement | HTMLImageElement;
    let shouldCloseBitmap = false;
    if (typeof image === "string") {
        const { img } = await offscreenLoadImage(image)
        newImage = img;
    }
    else if (
        image instanceof ImageBitmap ||
        image instanceof HTMLCanvasElement ||
        image instanceof HTMLImageElement
    ) {
        newImage = image;
    }
    else {
        newImage = await createImageBitmap(image);
        shouldCloseBitmap = true;
    }
    return new Promise<{ data: Blob, width: number, height: number, extension: string }>((resolve, reject) => {
        const finish = (result: { data: Blob, width: number, height: number, extension: string }) => {
            if (shouldCloseBitmap && newImage instanceof ImageBitmap) {
                newImage.close();
            }
            resolve(result);
        };
        const fail = (error: unknown) => {
            if (shouldCloseBitmap && newImage instanceof ImageBitmap) {
                newImage.close();
            }
            reject(error);
        };
        try {
            const extension = ".png";
            if (newImage instanceof ImageBitmap) {
                const canvas = document.createElement('canvas')
                const ctx = canvas.getContext('2d')
                const requireSetTransform = matrix && (Math.abs(matrix.a) == 1 && Math.abs(matrix.b) == 0 && Math.abs(matrix.c) == 0 && Math.abs(matrix.d) == 1);

                let width = newImage.width;
                let height = newImage.height;
                if (maxSize && (maxSize < newImage.width || maxSize < newImage.height)) {
                    if (width > height) {
                        const scale = width / maxSize;
                        width = maxSize
                        height = newImage.height / scale;
                    }
                    else {
                        const scale = height / maxSize;
                        height = maxSize
                        width = width / scale;
                    }
                    canvas.width = width
                    canvas.height = height
                    if (requireSetTransform) {
                        const x = matrix.a < 0 ? Math.abs(matrix.a) * width : 0;
                        const y = matrix.d < 0 ? Math.abs(matrix.d) * height : 0;
                        ctx.setTransform(matrix.a, matrix.b, matrix.c, matrix.d, x, y)
                    }
                    ctx.drawImage(newImage, 0, 0, width, height)
                }
                else {
                    canvas.width = width
                    canvas.height = height
                    if (requireSetTransform) {
                        const x = matrix.a < 0 ? Math.abs(matrix.a) * width : 0;
                        const y = matrix.d < 0 ? Math.abs(matrix.d) * height : 0;
                        ctx.setTransform(matrix.a, matrix.b, matrix.c, matrix.d, x, y)
                    }
                    ctx.drawImage(newImage, 0, 0)
                }
                canvas.toBlob((r) => {
                    finish({ data: r, width, height, extension })
                })
            } else {
                let width = newImage.width;
                let height = newImage.height;
                if (compareTagName(newImage.tagName, "IMG") || (maxSize && (maxSize < newImage.width || maxSize < newImage.height))) {
                    const canvas = document.createElement('canvas')
                    const ctx = canvas.getContext('2d')
                    if ((maxSize && (maxSize < newImage.width || maxSize < newImage.height))) {
                        if (width > height) {
                            const scale = width / maxSize;
                            width = maxSize
                            height = newImage.height / scale;
                        }
                        else {
                            const scale = height / maxSize;
                            height = maxSize
                            width = width / scale;
                        }
                    }
                    canvas.width = width
                    canvas.height = height
                    ctx.drawImage(newImage, 0, 0, width, height)
                    canvas.toBlob((r) => {
                        finish({ data: r, width, height, extension })
                    })
                }
                else {
                    (newImage as HTMLCanvasElement).toBlob((r) => {
                        finish({ data: r, width, height, extension })
                    })
                }
            }
        }
        catch (e) {
            fail(e)
        }
    })
};

export const getImageSize = async (imageSource: ImageBitmapSource | string): Promise<{ width: number, height: number }> => {
    if (typeof imageSource === "string") {
        const result = await offscreenLoadImage(imageSource)
        return { width: result.width, height: result.height }
    }
    if (
        imageSource instanceof ImageBitmap ||
        imageSource instanceof HTMLImageElement ||
        imageSource instanceof HTMLCanvasElement ||
        imageSource instanceof OffscreenCanvas ||
        imageSource instanceof ImageData
    ) {
        return { width: imageSource.width, height: imageSource.height }
    }
    if (imageSource instanceof HTMLVideoElement) {
        return { width: imageSource.videoWidth, height: imageSource.videoHeight }
    }
    let bitmap: ImageBitmap | undefined;
    try {
        bitmap = await createImageBitmap(imageSource);
        return { width: bitmap.width, height: bitmap.height };
    }
    finally {
        bitmap?.close();
    }
};

export const createBlobUrl = async (image: ImageBitmap | HTMLCanvasElement, matrix?: SimpleMatrix, maxSize?: number): Promise<{ url: string, width: number, height: number, extension: string }> => {
    const blob = await getBlob(image, matrix, maxSize)
    return { url: URL.createObjectURL(blob.data), width: blob.width, height: blob.height, extension: blob.extension };
};

export const getRequireHighlightCodeElements = (ownerDocument: Document) => {
    const body = getDocumentBody(ownerDocument);
    if (!body) {
        return [];
    }
    const pres = body.getElementsByTagName("pre");
    const presLength = pres.length
    if (presLength == 0) {
        return [];
    }
    const requireHighlightItems = []
    for (let i = 0; i < presLength; i++) {
        const pre = pres[i];
        if (pre.firstElementChild && (pre.firstElementChild.tagName == "CODE" || pre.firstElementChild.tagName.toLowerCase() == "code")) {
            if (pre.firstElementChild.children.length == 0) {
                requireHighlightItems.push(pre.firstElementChild)
            }
        }
        else {
            if (pre.children.length == 0) {
                requireHighlightItems.push(pre)
            }
        }
    }
    if (requireHighlightItems.length == 0) {
        return [];
    }
    return requireHighlightItems;
};

export const copyImage = async (image: ImageBitmapSource | string, matrix?: SimpleMatrix, maxSize?: number) => {
    if (!BrowserCapabilities.supportClipboardPng()) {
        throw new Error('Unsupport copy image to clipboard.')
    }
    const item = new ClipboardItem({
        'image/png': getBlob(image, matrix, maxSize).then(blob => {
            return blob.data;
        })
    })
    await navigator.clipboard.write([item]);
};
