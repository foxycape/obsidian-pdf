import { FileLocation } from "../../../../kernal";
import { HtmlOptions } from "../../HtmlOptions";
import { IHtmlDocument } from "../IHtmlDocument";

export interface IHtmlElementLocator {
    locateElement(doc: IHtmlDocument, location: FileLocation, options: HtmlOptions): Promise<ElementLocatorResult>;
}

export type ElementLocatorResult = {
    target: Element;
    pageNumber?: number;
    isDocumentStart: boolean;
};
