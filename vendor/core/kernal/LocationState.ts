import { IDocument } from "./IDocument";

export class LocationState {
    scrollTop: number;
    scrollLeft: number;
    width: number;
    height: number;
    transformLeft: number;
    transformTop: number;
    firstVisibleDocument: IDocument;
    offsetLeft: number;
    offsetTop: number;
    foundElement: boolean;
}
