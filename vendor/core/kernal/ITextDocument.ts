import { IDisposable } from "./IDisposable";
import { TextFormatOptions } from "./IDocument";

export interface ITextDocument extends IDisposable {
    get url(): string;
    /**
     * Get the plain text content of the document
     * @param options 
     */
    getPlaintext(options?: TextFormatOptions): Promise<string>
}