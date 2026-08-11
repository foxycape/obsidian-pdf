import { IDocument } from "../../../kernal";

export interface IHtmlDocument extends IDocument {
    /**
     * Get the original document content.
     */
    getContent(): Promise<string>;

    /**
     * Get the total number of pages.
     */
    getNumberOfPages(): Promise<number>;

    /**
     * Get the page number of the element.
     * @param element 
     */
    getPageNumber(element: Element): Promise<number>;

    /**
     * Get the content container of the current document that has not been loaded (if there is an iframe, return the body of the iframe, otherwise return the same as getContentContainer).
     * @param raw Whether to return the original document content (the virtual document may be modified by other functions, if you need to get the original document content, pass in true, if you need to modify this document after getting the document, do not pass this parameter).
     */
    getVirtualContentContainer(raw?: boolean): Promise<HTMLElement>;

    /**
     * Get all visually visible elements in the document window.
     * @param fullVisibleInWindow when true, only fully contained elements are returned.
     */
    getVisibleElements(fullVisibleInWindow?: boolean): Element[];
}
