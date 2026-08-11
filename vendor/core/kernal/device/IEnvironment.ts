export interface IEnvironment {  
    /**
     * Gets the host language.
     * @param defaultLanguage Fallback language when the browser language is unavailable.
     * @param excludeRegion Whether to exclude the region code.
     * @param supportedLanguages Supported language list (including region).
     */
    getLanguage(defaultLanguage?: string, excludeRegion?: boolean, supportedLanguages?: string[]): string;

    /**
     * Checks whether the language is Chinese.
     * @param language Language code to check.
     */
    isChinese(language: string): boolean;

    /** Gets the preferred OS color theme (`dark` or `light`). */
    getOSThemeName(): 'dark' | 'light';

}