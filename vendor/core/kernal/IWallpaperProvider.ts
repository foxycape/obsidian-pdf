import { IDisposable } from ".";

/**
 * wallpaper
 */
export interface IWallpaperProvider extends IDisposable {

    /**
     * initialize
     */
    initialize(): Promise<void>;

    /**
     * get wallpaper list
     */
    getWallpapers(): Wallpaper[];

    /**
     * get wallpaper
     * @param wallpaperName wallpaper name
     */
    getWallpaper(wallpaperName: string): Wallpaper | undefined;

    /**
     * get current wallpaper
     */
    getCurrentWallpaper(): Wallpaper | undefined;

    /**
     * change wallpaper
     * @param target wallpaper element
     */
    changeWallpaper(wallpaper: Wallpaper | string): void;

    /**
     * cancel wallpaper
     */
    cancelWallpaper(): void;

    /**
     * get wallpaper applied style name
     */
    getWallpaperClassName(): string;
}


export class Wallpaper {
    isDefault: boolean;
    name: string;
    description: string = "";
    /**background image thumbnail */
    wallpaperThumbnail: string = "";
    /**background image */
    wallpaperUrl: string = "";
    /**background style, the url variable is $url for example:
     * background: url($url) no-repeat fixed center center/cover;
     * the $url will be replaced with the value of wallpaperUrl
     */
    background: string = "inherit";
    /**opacity */
    opacity: number = 1;
}
