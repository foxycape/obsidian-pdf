import type { IL10n } from "../../../pdfjs/types/web/interfaces";

/**
 * No-op l10n for pdf.js.
 * Prevents GenericL10n from applying page landmark aria-labels (hover "Page N" tips).
 */
export class PdfNoopL10n implements IL10n {
    getLanguage = (): string => "en-us";

    getDirection = (): string => "ltr";

    get = async (
        _ids: string[] | string,
        _args?: object | null,
        fallback?: string,
    ): Promise<string> => fallback ?? "";

    translate = async (_element: HTMLElement): Promise<void> => { };

    pause = (): void => { };

    resume = (): void => { };
}
