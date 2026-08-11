import { IDisposable } from "../../../../kernal";

/**
 * HTML document preloading and unnecessary document release.
 */
export interface IHtmlDocumentsPreloader extends IDisposable {
    /**
     * Preload documents.
     */
    preloadDocuments(): Promise<void>;
}
