import { IDisposable, IDocument } from "../../../kernal";

export interface IHtmlLoadLayer extends IDisposable {
    /**
     * set document
     */
    setDoc(doc: IDocument): void;

    /**
     * show loading layer
     */
    loadLoadingLayer(): void;

    /**
     * remove loading layer
     */
    removeLoadingLayer(): void;

    /**
     * show reload button
     */
    setReloadButton(): void;
}
