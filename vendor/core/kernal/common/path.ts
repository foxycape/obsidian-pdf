import { getExtentionByMimetype, getMimetype } from "./mimetypes";
import { checkIsAbsoluteUrl, getFullUrl } from "./url";
import { getRandomId, getUuid } from "./uuid";
import { isNullOrWhiteSpace, startsWith } from "./text";

export const getExtension = (url: string, toLowerCase?: boolean): string => {
    if (isNullOrWhiteSpace(url))
        return null;
    let path = url;
    try {
        const fullUrl = getFullUrl(url);
        path = fullUrl.pathname;
    }
    catch (e) {
        //
    }
    const lastDotPosition = path.lastIndexOf(".");
    if (lastDotPosition < 0) {
        return null;
    }
    let extension = path.substring(lastDotPosition);
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

export const getFileName = (url: string): string => {
    if (typeof url != "string") {
        return ''
    }
    if (isNullOrWhiteSpace(url))
        return '';
    let fileName = url;
    const lastHashPosition = fileName.lastIndexOf("#")
    if (lastHashPosition >= 0) {
        fileName = fileName.substring(0, lastHashPosition);
    }
    const lastQuestionMarkPosition = fileName.lastIndexOf("?")
    if (lastQuestionMarkPosition >= 0) {
        fileName = fileName.substring(0, lastQuestionMarkPosition);
    }
    let lastSlashPosition = url.lastIndexOf("/");
    if (lastSlashPosition < 0) {
        lastSlashPosition = url.lastIndexOf("\\");
    }
    if (lastSlashPosition >= 0) {
        fileName = fileName.substring(lastSlashPosition + 1);
    }
    return fileName;
};

export const getFileNameWithoutExtension = (url: string): string => {
    let fileName = getFileName(url)
    if (isNullOrWhiteSpace(fileName))
        return '';
    const lastDotPosition = fileName.lastIndexOf(".")
    if (lastDotPosition > 0) {
        fileName = fileName.substring(0, lastDotPosition);
    }

    return fileName;
};

export const formatExtension = (extension: string, removeDot?: boolean): string => {
    if (!extension)
        return ""
    let lowerExtension = extension.toLowerCase();
    if (!(lowerExtension.charAt(0) == ".")) {
        lowerExtension = "." + lowerExtension;
    }
    if (removeDot && lowerExtension) {
        lowerExtension = lowerExtension.substring(1)
    }
    return lowerExtension;
};

export const formatSaveFileName = (fileName: string, appendRandom?: boolean) => {
    let requireAppend = appendRandom
    let newFileName = getFileName(fileName);
    if (!newFileName) {
        newFileName = getRandomId();
        requireAppend = false;
    }
    let extension = getExtension(newFileName)
    const isDataFormat = checkIsAbsoluteUrl(fileName) && startsWith(fileName, "data:", true)
    if (isDataFormat) {
        extension = getExtentionByMimetype(getMimetype(fileName));
        newFileName = getRandomId() + extension;
        requireAppend = false;
    }
    else {
        if (!extension) {
            newFileName += '.jpg';
        }
    }
    if (requireAppend) {
        const fileNameWithoutExtension = getFileNameWithoutExtension(newFileName);
        extension = getExtension(newFileName)
        const random = getUuid().substring(0, 5);
        newFileName = fileNameWithoutExtension + '-' + random + extension;
    }
    return newFileName;
};
