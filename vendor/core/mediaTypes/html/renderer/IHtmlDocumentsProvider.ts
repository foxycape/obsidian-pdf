import { IHtmlDocument } from "./IHtmlDocument";
import { IDocumentsProvider } from "../../../kernal";

export interface IHtmlDocumentsProvider extends IDocumentsProvider<IHtmlDocument> {
    getCurrentPageNumber(doc: IHtmlDocument): number;
}