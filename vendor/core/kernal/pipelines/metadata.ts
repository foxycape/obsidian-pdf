import { getFileName } from "../common/path";
import { checkIsAbsoluteUrl } from "../common/url";
import { Metadata } from "../Metadata";
import { FilePackage } from "../IFileParser";

export const formatMetadata = (metadata: Metadata, url: any, extension: string): Metadata => {
    if (!metadata) {
        metadata = new Metadata();
    }
    if (!metadata.title || typeof metadata.title !== 'string') {
        if (typeof url === "string") {
            metadata.title = getFileName(url)?.trim()
        }
        else {
            metadata.title = "";
        }
    }
    if (metadata.fileName && typeof metadata.fileName !== 'string') {
        metadata.fileName = "";
    }
    if (metadata.author) {
        if (typeof metadata.author === 'string') {
            metadata.author = [metadata.author];
        }
        else {
            if (!Array.isArray(metadata.author)) {
                metadata.author = [];
            }
            else {
                const authors: string[] = [];
                for (const author of metadata.author) {
                    if (typeof author === 'string') {
                        authors.push(author)
                    }
                }
                metadata.author = authors;
            }
        }
    }
    if (metadata.subject) {
        if (typeof metadata.subject === 'string') {
            metadata.subject = [metadata.subject];
        }
        else {
            if (!Array.isArray(metadata.subject)) {
                metadata.subject = [];
            }
            else {
                const subjects: string[] = [];
                for (const s of metadata.subject) {
                    if (typeof s === 'string') {
                        subjects.push(s)
                    }
                }
                metadata.subject = subjects;
            }
        }
    }
    if (metadata.description && typeof metadata.description !== 'string') {
        metadata.description = "";
    }
    if (metadata.rights && typeof metadata.rights !== 'string') {
        metadata.rights = "";
    }
    if (metadata.publisher && typeof metadata.publisher !== 'string') {
        metadata.publisher = "";
    }
    if (metadata.issueDate && typeof metadata.issueDate !== 'string') {
        metadata.issueDate = "";
    }
    if (metadata.size && typeof metadata.size !== 'number') {
        metadata.size = 0;
    }
    metadata.extension = extension;
    try {
        if (!metadata.fileName) {
            if (typeof url === "string") {
                if (checkIsAbsoluteUrl(url)) {
                    metadata.fileName = getFileName(url)
                }
                else {
                    let isSimpleUrl = false;
                    try {
                        JSON.parse(url)
                        isSimpleUrl = false
                    }
                    catch (e) {
                        isSimpleUrl = true;
                    }
                    if (isSimpleUrl) {
                        metadata.fileName = getFileName(url)?.trim()
                    }
                }
            }
            else if (url instanceof FilePackage) {
                if (url.fileName) {
                    metadata.fileName = url.fileName?.trim();
                }
                else if (url.fileUrl && typeof url.fileUrl === "string" && checkIsAbsoluteUrl(url.fileUrl)) {
                    metadata.fileName = getFileName(url.fileUrl)?.trim()
                }
            }
            else if (globalThis.FileSystemFileHandle && url instanceof globalThis.FileSystemFileHandle) {
                metadata.fileName = url.name?.trim()
            }
        }
        if (metadata.fileName?.length > 1000) {
            metadata.fileName = '';
        }
    } catch (e) {
        //
    }
    return metadata;
}