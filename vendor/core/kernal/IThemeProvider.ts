import { IDisposable, Theme } from ".";

/**
 * Theme provider
 */
export interface IThemeProvider extends IDisposable {

    /**
     * Initialize
     */
    initialize(): Promise<void>;

    /**
     * Get the theme list
     */
    getThemes(): Theme[];

    /**
     * Get the theme
     * @param themeName The name of the theme
     */
    getTheme(themeName: string): Theme | undefined;

    /**
     * Get the current theme
     */
    getCurrentTheme(): Theme | undefined;
}
