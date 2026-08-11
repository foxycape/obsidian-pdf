export declare global {
    interface Element {
        /**Visible in a specified range, not necessarily visible on the screen */
        isVisible: boolean;

        /**Visible in the window */
        isVisibleInWindow: boolean;

        /**Fully visible in the window */
        isFullVisibleInWindow: boolean;

        /**
         * Element sequence number
         */
        sequence: number;
    }
}
