import { IDocument, IDisposable } from "../../../../kernal";

export interface IHtmlImageLoader extends IDisposable {
    /** Preprocess document images (placeholder, size probing, inline styles). Hook into documentPreprocesses. */
    preprocessImages(doc: IDocument): Promise<void>;
    /** Load images for the given visible elements. */
    loadImages(doc: IDocument, visibleElements: Element[]): Promise<void>;
}
