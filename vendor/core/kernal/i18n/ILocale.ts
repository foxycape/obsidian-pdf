import { IDisposable } from "../IDisposable";

export interface ILocale extends IDisposable {

    /**
     * Initialize
     */
    initialize(): Promise<void>;
    /**
     * Add a listener for language change
     * @param listener Listener function
     * @returns Function to remove the listener
     */
    onLanguageChange(listener: LocaleChangeListener): () => void;
    /**
     * Get localized text
     * @param key Key name
     * @param defaultText Default text
     * @param named Named replacement object. e.g. { name: "John", age: 30 }
     */
    getText(key: string, defaultText: string, named?: Object): string;

    /** Change language */
    changeLanguage(language: string): Promise<void>

    /**
     * Get the language currently used by the system
     * @param excludeRegion Whether to strip the region code, e.g. zh-cn becomes zh
     * @returns
     */
    getCurrentLanguage(excludeRegion?: boolean): string;

    /** Get the list of supported languages */
    getSupportedLanguages(): Language[];
}

export class Language {
    /**
     * Constructor
     * @param code Language code
     * @param title Language name
     * @param nativeTitle Native language name
     * @param dir Text direction
     */
    constructor(code?: string, title?: string, nativeTitle?: string, dir?: string) {
        this.code = code;
        this.title = title;
        this.nativeTitle = nativeTitle;
        this.dir = dir;
    }

    /** Language code, e.g. zh-cn */
    code: string;
    /** Language title, e.g. Chinese */
    title: string;
    /** Native name of the language */
    nativeTitle?: string;
    /** Text direction */
    dir?: string;
}
export type LocaleChangeListener = (language: string) => void;