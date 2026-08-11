import { ITextDocument } from "../../../kernal/ITextDocument";

export interface IHtmlTextDocument extends ITextDocument {
    /**
     * Get the original document content
     */
    getContent(): Promise<string>;

    /**
     * Get the formatted document content, which will always return the original document
     */
    getFormattedDocument(): Promise<Document>;
}