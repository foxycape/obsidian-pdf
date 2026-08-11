import { IHtmlDocument } from "../IHtmlDocument";

export interface IHtmlContentProcessor {
    /**
     * Process the content of the document.
     * @param doc 
     * @returns 
     */
    preprocess(doc: IHtmlDocument): Promise<void>;

    /**
     * Dispose the content processor.
     */
    dispose(): Promise<void>;
}