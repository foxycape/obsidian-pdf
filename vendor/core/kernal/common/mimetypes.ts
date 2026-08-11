import { checkIsAbsoluteUrl } from "./url";
import { isNullOrWhiteSpace, startsWith } from "./text";

const defaultMimetype = 'application/octet-stream';
const mimetypes: Map<string, string[]> = new Map<string, string[]>([
    [".3g2", ["video/3gpp2"]],
    [".3gp", ["video/3gpp"]],
    [".3gp2", ["video/3gpp2"]],
    [".3gpp", ["video/3gpp"]],
    [".aa", ["audio/audible"]],
    [".aac", ["audio/aac"]],
    [".aax", ["audio/vnd.audible.aax"]],
    [".ac3", ["audio/ac3"]],
    [".adt", ["audio/vnd.dlna.adts"]],
    [".adts", ["audio/aac"]],
    [".aif", ["audio/x-aiff"]],
    [".aifc", ["audio/aiff"]],
    [".aiff", ["audio/aiff"]],
    [".art", ["image/x-jg"]],
    [".asf", ["video/x-ms-asf"]],
    [".asr", ["video/x-ms-asf"]],
    [".asx", ["video/x-ms-asf"]],
    [".au", ["audio/basic"]],
    [".avi", ["video/x-msvideo"]],
    [".webp", ["image/webp"]],
    [".bmp", ["image/bmp"]],
    [".css", ["text/css"]],
    [".flv", ["video/x-flv"]],
    [".gif", ["image/gif"]],
    [".htm", ["text/html"]],
    [".html", ["text/html"]],
    [".ico", ["image/x-icon"]],
    [".jpeg", ["image/jpeg"]],
    [".jpg", ["image/jpg", "image/jpeg"]],
    [".js", ["application/x-javascript"]],
    [".json", ["application/json"]],
    [".m1v", ["video/mpeg"]],
    [".m2t", ["video/vnd.dlna.mpeg-tts"]],
    [".m2ts", ["video/vnd.dlna.mpeg-tts"]],
    [".m2v", ["video/mpeg"]],
    [".m3u", ["audio/x-mpegurl"]],
    [".m3u8", ["audio/x-mpegurl"]],
    [".m4a", ["audio/m4a"]],
    [".m4b", ["audio/m4b"]],
    [".m4p", ["audio/m4p"]],
    [".m4r", ["audio/x-m4r"]],
    [".m4v", ["video/x-m4v"]],
    [".mid", ["audio/mid"]],
    [".midi", ["audio/mid"]],
    [".mod", ["video/mpeg"]],
    [".mov", ["video/quicktime"]],
    [".mp3", ["audio/mpeg"]],
    [".mp4", ["video/mp4"]],
    [".mp4v", ["video/mp4"]],
    [".mpa", ["video/mpeg"]],
    [".mpe", ["video/mpeg"]],
    [".mpeg", ["video/mpeg"]],
    [".mpg", ["video/mpeg"]],
    [".mpv2", ["video/mpeg"]],
    [".mqv", ["video/quicktime"]],
    [".png", ["image/png"]],
    [".pptx", ["application/vnd.openxmlformats-officedocument.presentationml.presentation"]],
    [".svg", ["image/svg+xml"]],
    [".ts", ["video/vnd.dlna.mpeg-tts"]],
    [".txt", ["text/plain"]],
    [".wav", ["audio/wav"]],
    [".wave", ["audio/wav"]],
    [".wma", ["audio/x-ms-wma"]],
    [".xlsx", ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]],
    [".xml", ["text/xml"]],
    [".xhtml", ["application/xhtml+xml"]],
    [".woff", ["application/x-font-woff"]],
    [".woff2", ["application/x-font-woff2"]],
    [".otf", ["application/x-font-opentype"]],
    [".eot", ["application/vnd.ms-fontobject"]],
    [".opf", ["application/oebps-package+xml"]],
    [".ncx", ["application/x-dtbncx+xml"]]
]);

const getExtensionInner = (url: string, toLowerCase?: boolean): string | null => {
    if (isNullOrWhiteSpace(url))
        return null;
    const lastDotPosition = url.lastIndexOf(".");
    if (lastDotPosition < 0) {
        return null;
    }
    let extension = url.substring(lastDotPosition);
    if (extension.lastIndexOf("?") > 0) {
        extension = extension.substring(0, extension.lastIndexOf("?"));
    }
    if (extension.lastIndexOf("#") > 0) {
        extension = extension.substring(0, extension.lastIndexOf("#"));
    }
    if (toLowerCase) {
        return extension.toLowerCase();
    }
    return extension;
};

export const getMimetype = (key: string) => {
    if (checkIsAbsoluteUrl(key)) {
        const isDataFormat = startsWith(key, "data:", true)
        if (isDataFormat) {
            return key.split(/[:,;]/g)[1];
        }
    }
    const extension = getExtensionInner(key, true);
    if (!extension) {
        return defaultMimetype;
    }
    const mimetypesList = mimetypes.get(extension);
    if (mimetypesList && mimetypesList.length > 0) {
        return mimetypesList[0];
    }
    return defaultMimetype;
};

export const getExtentionByMimetype = (mimetype: string) => {
    if (!mimetype) {
        return ".file"
    }
    mimetype = mimetype.toLowerCase();
    for (const [key, values] of mimetypes.entries()) {
        if (values.includes(mimetype)) {
            return key;
        }
    }
};

export const getImageMimetype = (imageUrl: string) => {
    let mimetype = "image/jpg";
    if (isNullOrWhiteSpace(imageUrl))
        return mimetype;
    const extension = getExtensionInner(imageUrl, true);

    if (extension == ".png") {
        mimetype = "image/png";
    }
    else if (extension == ".bmp") {
        mimetype = "image/bmp";
    } else if (extension == ".gif") {
        mimetype = "image/gif";
    }
    return mimetype;
};
