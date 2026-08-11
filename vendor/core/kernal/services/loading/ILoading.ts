
export interface ILoading {
    /**
     * Initialize loading
     * @param container 
     * @param options 
     */
    initialize(container: HTMLElement,options?: LoadingOptions): Promise<void>;

    /**
     * Show loading layer
     * @param text Specify loading text
     */
    show(text?: string): Promise<void>;

    /**
     * Close loading layer
     */
    hide(): Promise<void>;
}

export class LoadingOptions{
    /** Whether to disable the loading theme */
    disableLoadingTheme?: boolean;
    /** The text color of the loading */
    textColor?: string;
    /** The background color of the loading layer */
    backgroundColor?: string;
    /** The icon color of the loading */
    iconColor?: string;
}