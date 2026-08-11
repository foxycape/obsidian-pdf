import { BrowserCapabilities } from "./web/BrowserCapabilities";
import { toCssVariableName } from "./common/naming";
import { Options } from "./Options";

/**
 * reader theme
 */
export class Theme {
    /** theme name */
    name: string = "default";
    /** theme title */
    title: string;
    /** whether is default theme */
    isDefault: boolean = false;
    /** whether to enable */
    enabled: boolean = true;
    /** color mode */
    colorMode: ColorMode;
    /** theme visual color value (for theme list display) */
    themeRepresentativeColor = "#f1f1f1";

    /** reader background */
    readerBackground: string = "#f6f6f6";
    /** animation when jumping to the target */
    gotoTargetAnimationColor: string = "rgba(255,150,50,0.4)";
    contentBackground: string = "#fff";
    contentTextColor: string = "inherit";
    codeblockBackgroundColor: string = "#f9f9f9";
    selectionBackground: string = "rgba(255,213,0,0.35)";
    selectionColor: string = "inherit";
    columnRuleColor: string = "rgba(100, 100, 100, 0.1)";
    textAccentColor: string = "#14ae5c";
    textMutedColor: string = "#999";
    borderColor: string = "#e9e9e9";

    /** scrollbar thumb color */
    scrollbarThumbColor: string = "#999";
    /** scrollbar thumb hover color (WebKit / Blink only) */
    scrollbarThumbHoverColor: string = "#555";
    /** scrollbar track color */
    scrollbarTrackColor: string = "#f6f6f6";

    /**
     * extended CSS variables
     */
    vars?: Record<string, string>;

    static readonly ReaderBackground = toCssVariableName("readerBackground" satisfies ThemeCssKey);
    static readonly GotoTargetAnimationColor = toCssVariableName("gotoTargetAnimationColor" satisfies ThemeCssKey);
    static readonly ContentBackground = toCssVariableName("contentBackground" satisfies ThemeCssKey);
    static readonly ContentTextColor = toCssVariableName("contentTextColor" satisfies ThemeCssKey);
    static readonly CodeblockBackgroundColor = toCssVariableName("codeblockBackgroundColor" satisfies ThemeCssKey);
    static readonly ColumnRuleColor = toCssVariableName("columnRuleColor" satisfies ThemeCssKey);
    static readonly SelectionBackground = toCssVariableName("selectionBackground" satisfies ThemeCssKey);
    static readonly SelectionColor = toCssVariableName("selectionColor" satisfies ThemeCssKey);
    static readonly TextAccentColor = toCssVariableName("textAccentColor" satisfies ThemeCssKey);
    static readonly TextMutedColor = toCssVariableName("textMutedColor" satisfies ThemeCssKey);
    static readonly ScrollbarThumbColor = toCssVariableName("scrollbarThumbColor" satisfies ThemeCssKey);
    static readonly ScrollbarThumbHoverColor = toCssVariableName("scrollbarThumbHoverColor" satisfies ThemeCssKey);
    static readonly ScrollbarTrackColor = toCssVariableName("scrollbarTrackColor" satisfies ThemeCssKey);
    static readonly BorderColor = toCssVariableName("borderColor" satisfies ThemeCssKey);

    /** custom scrollbar style class */
    static readonly customScrollerClassName = "custom-scroller";

    /**
     * get scrollbar styles
     * @param prefixClassNameOrIds limit scrollbar range class name or id name, e.g. .myscroll or #addd
     */
    static getScrollStyles(prefixClassNameOrIds?: string | string[]) {
        // skip custom scrollbar when no fine pointer (pure touch screen); touchpads still enable due to mouse/touchpad
        if (!BrowserCapabilities.hasFinePointer()) {
            return "{}";
        }

        let scrollStyles = "";
        if (prefixClassNameOrIds) {
            let webkitScrollbarPrefixs = ''
            let webkitScrollbarThumbPrefixs = ''
            let webkitScrollbarTrackPrefixs = ''
            let firefoxPrefixs = '';
            if (typeof prefixClassNameOrIds == 'string') {
                webkitScrollbarPrefixs = prefixClassNameOrIds + "::-webkit-scrollbar"
                webkitScrollbarThumbPrefixs = prefixClassNameOrIds + "::-webkit-scrollbar-thumb"
                webkitScrollbarTrackPrefixs = prefixClassNameOrIds + "::-webkit-scrollbar-track"
                firefoxPrefixs = prefixClassNameOrIds
            }
            else {
                webkitScrollbarPrefixs = prefixClassNameOrIds.map(x => x + "::-webkit-scrollbar").join(',')
                webkitScrollbarThumbPrefixs = prefixClassNameOrIds.map(x => x + "::-webkit-scrollbar-thumb").join(',')
                webkitScrollbarTrackPrefixs = prefixClassNameOrIds.map(x => x + "::-webkit-scrollbar-track").join(',')
                firefoxPrefixs = prefixClassNameOrIds.join(',')
            }

            scrollStyles += `${webkitScrollbarPrefixs}{width:var(${Options.ScrollbarSize}) !important;height:var(${Options.ScrollbarSize}) !important;}`;
            scrollStyles += `${webkitScrollbarThumbPrefixs}{border: var(${Options.ScrollbarBorder}) solid transparent !important;background-clip:padding-box !important;background-color:var(${Theme.ScrollbarThumbColor}) !important;min-width:40px !important;min-height:40px !important;padding-top:100px !important;border-radius:var(${Options.ScrollbarRadius}) !important;}`;
            scrollStyles += `${webkitScrollbarThumbPrefixs}:hover{background-color:var(${Theme.ScrollbarThumbHoverColor}) !important;}`;
            scrollStyles += `${webkitScrollbarTrackPrefixs}{background:var(${Theme.ScrollbarTrackColor}) !important;border-radius:var(${Options.ScrollbarRadius}) !important;}`;
            scrollStyles += "@-moz-document url-prefix(){" + firefoxPrefixs + "{scrollbar-width:thin}}"
            scrollStyles += "@-moz-document url-prefix(){" + firefoxPrefixs + "{scrollbar-color:var(" + Theme.ScrollbarThumbColor + ") var(" + Theme.ScrollbarTrackColor + ") !important}}"
        }
        if (!scrollStyles) {
            scrollStyles = "{}";
        }
        return scrollStyles
    }
}

export type ColorMode = "light" | "dark" | "other";

/**
 * The properties that will be injected as CSS variables in Theme.
 * Naming rule: camelCase → --kebab-case (e.g.: readerBackground → --reader-background)
 */
export const ThemeCssKeys = [
    "readerBackground",
    "gotoTargetAnimationColor",
    "contentBackground",
    "contentTextColor",
    "codeblockBackgroundColor",
    "columnRuleColor",
    "selectionBackground",
    "selectionColor",
    "scrollbarThumbColor",
    "scrollbarThumbHoverColor",
    "scrollbarTrackColor",
    "textAccentColor",
    "textMutedColor",
    "borderColor",
] as const satisfies readonly (keyof Theme)[];

export type ThemeCssKey = typeof ThemeCssKeys[number];
