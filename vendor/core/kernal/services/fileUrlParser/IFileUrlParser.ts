import { Metadata } from "../../Metadata";
import { SpineFile } from "../../IFileParser";
import { Nav } from "../../nav/Nav";
import { OpenOptions } from "../../OpenOptions";

export interface IFileUrlParser {
    parse(url: any, options?: FileUrlParserOptions): Promise<UrlParseResult>
}

export class FileUrlParserOptions extends OpenOptions {
    /**File downloading progress callback */
    fileDownloadingCallback?: (contentLength: number, receivedLength: number, done: boolean) => Promise<void>
}

export class UrlParseResult {
    mainUrl?: string;
    data?: ArrayBuffer
    metadata?: Metadata
    nav?: Nav
    isMultiFiles:boolean=false;
    spineFiles: SpineFile[] = [];
    requireSignUrl: boolean = false;
    base: string = "";
    requireCalculateFileSymbolCount = false;
}