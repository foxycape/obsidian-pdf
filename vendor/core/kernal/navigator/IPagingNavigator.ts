import { IDisposable } from "../IDisposable";
import { IDocument } from "../IDocument";
import { PageDirection } from "../types";

/**
 * paging navigator
 */
export interface IPagingNavigator extends IDisposable {

    /**
     * Jump to specified page number
     * @param doc document to jump to
     * @param pageNumber page number
     * @param extra options for the jump
     */
    gotoPage(doc: IDocument, pageNumber: number, extra?: PagingExtra): Promise<boolean>;

    /**
     * Jump to next page
     * @param extra options for the jump
     */
    gotoNextPage(extra?: PagingExtra): Promise<boolean>;

    /**
     * Jump to previous page
     * @param extra 
     */
    gotoPreviousPage(extra?: PagingExtra): Promise<boolean>;
}

export class PageChangeOptions {
    pageNumber: number;
    doc?: IDocument
    direction?: PageDirection
    extra?: PagingExtra
}

export class PagingExtra {
    /**Trigger user-user page flip app-application page flip */
    trigger?: 'user' | 'app'

    /**
     * Trigger type mouse-mouse click, touch-touch, keyboard-keyboard key, pen-pen
     */
    triggerType?: 'mouse' | 'touch' | 'keyboard' | 'pen' | (string & {})
}
