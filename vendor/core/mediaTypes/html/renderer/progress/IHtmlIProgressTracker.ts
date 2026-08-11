import { IDisposable, IProgressTracker } from "../../../../kernal";

export type IHtmlProgressTracker = IProgressTracker & IDisposable & {
    /**
     * Get the progress percentage of the specified element or page number.
     * @param url
     * @param target The specified element or page number, or the element position.
     */
    getPercentage(url: string, target: Element | number | { tagName: string, tagIndex: number }): Promise<number>;
    /**
     * Recalculate progress and emit ProgressChange when the user has changed position.
     */
    notifyProgressChange(): void;
};