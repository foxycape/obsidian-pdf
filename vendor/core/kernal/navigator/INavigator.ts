import { FileLocation, SymbolType } from "..";

/**
 * core navigator
 */
export interface ICoreNavigator {

    /**
      * Location jump
      * @param location location to jump to
      */
    goto(location: FileLocation): Promise<void>;

    /**
     * Jump to url
     * @param url url to jump to, supports anchors, for example: a.html#top-and-bottom
     */
    gotoUrl(url: string): Promise<void>;

    /**
     * Jump to specified percentage (decimal, for example: 0.125 represents 12.5%)
     * @param percentage percentage (decimal, for example: 0.125 represents 12.5%)
     * @param options options
     */
    gotoPercentage(percentage: number, options?: GotoPercentegeOptions): Promise<void>;

}

export class GotoPercentegeOptions {
    percentageSymbolType: SymbolType;
}
