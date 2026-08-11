import { IDisposable } from "../../IDisposable";

/** font-display strategy used when loading fonts */
export type FontDisplay = "auto" | "block" | "swap" | "fallback" | "optional";

/**
 * Font load options.
 * Supports dynamically generating CSS / subsets from text (e.g. Google Fonts `text` parameter).
 */
export type FontLoadOptions = {
    /** Text used for subsetting; when provided, the implementation may generate CSS for those characters */
    text?: string;
    /** Weights required for this load; falls back to the font's supportedFontWeight when omitted */
    weights?: string[];
    /** CSS font-display */
    display?: FontDisplay;
};

/**
 * Font provider interface
 */
export interface IFontProvider extends IDisposable {

    /**
     * Initialize
     */
    initialize(): Promise<void>;

    /**
     * Reload fonts
     */
    reload(): Promise<void>;

    /** Whether local fonts are supported */
    get supportLocalFonts(): boolean

    /**
     * Load local fonts
     * @param showMessageWhenFail Show a message when an error occurs
     */
    loadLocalFonts(showMessageWhenFail: boolean): Promise<boolean>;

    /**
     * Remove local fonts
     */
    removeLocalFonts(): Promise<void>;

    /**
     * Get the font list for each language
     * @param language Optional language filter
     */
    getFonts(language?: string): Promise<Font[]>;

    /**
     * Get a font
     * @param name Font name
     */
    getFont(name: string): Promise<Font>;

    /**
     * Get the current font
     */
    getCurrentFont(): Promise<Font>;

    /**
     * Add a font
     * @param language
     * @param font
     */
    addFont(font: Font): void;

    /**
     * Add fonts
     * @param language
     * @param fonts
     */
    addFonts(fonts: Font[]): void;

    /**
     * Remove a font
     */
    removeFont(font: Font | string): void;

    /**
     * Remove fonts
     */
    removeFonts(fonts: Font[]): void;

    /**
     * Change the current font.
     * @param font Font object or font name
     * @param options Optional; when `text` is set, a text-based subset may be loaded dynamically
     */
    changeFont(font: Font | string, options?: FontLoadOptions): Promise<void>;

    /**
     * Activate a font.
     * @param ownerDocument
     * @param font
     * @param options Optional; when `text` is set, CSS may be generated and injected dynamically
     */
    activateFont(ownerDocument: Document, font: Font, options?: FontLoadOptions): Promise<void>;

    /**
     * Clear all fonts
     */
    clear(): void;
}


export class Font {
    /**
     * Constructor
     * @param name Unique font identifier
     * @param family Font family name
     * @param title Font display title
     * @param supportedOS Supported OS names; `["*"]` or `"*"` means all systems
     */
    constructor(public name: string, public family: string, public title: string, public supportedOS?: string[] | string) {

    }
    postscriptName?: string;
    
    /** Supported font weights: 200-light, normal-regular, bold-bold */
    supportedFontWeight?: string[] = ["200", "normal", "bold"];

    /** Supported language(s) */
    language?: string | string[];

    /** Whether this is a system font */
    isSystemFont?: boolean;

    /** Whether this is the default font */
    isDefault?: boolean;

    /** Sample text */
    sampleText?: string;

    /**
     * CSS API base URL (e.g. Google Fonts: https://fonts.googleapis.com/css2).
     * When set, the implementation may build and fetch CSS dynamically using FontLoadOptions.text.
     */
    cssApiUrl?: string;

    // Font resources (static files; used instead of or together with cssApiUrl)
    urls?: FontResource[];
}

/** Font resource kind: a static font file, or a CSS API that can generate stylesheets dynamically */
export type FontResourceKind = "file" | "css-api";

export class FontResource {
    /**
     * Constructor
     * @param url Font URL, or CSS API endpoint
     * @param format truetype, woff, woff2, svg; optional when kind is css-api
     * @param kind Resource kind; defaults to file
     * @param unicodeRange Optional unicode-range for @font-face
     */
    constructor(
        public url: string,
        public format?: string,
        public kind: FontResourceKind = "file",
        public unicodeRange?: string,
    ) {

    }
}

export class FontConfig {
    language: string;
    isDefault: boolean = false;
    fonts: Font[];
}
