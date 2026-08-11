import { Theme } from "../../../../kernal";
import { IHtmlDocument } from "../IHtmlDocument";

export interface IHtmlThemeApplier {
    /**
     * Apply theme to the document.
     * @param theme 
     * @returns 
     */
    applyTheme(theme: Theme): Promise<void>;
    
    /**
     * Apply theme to the document.
     * @param doc
     * @param theme
     * @returns
     */
    applyToDocument(doc: IHtmlDocument, theme: Theme): Promise<void>;
}