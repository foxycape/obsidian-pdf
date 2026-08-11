import { NavPoint } from "../nav/Nav";

/**目录导航 */
export interface INavPointNavigator {

    /**
     * Get chapter progress
     */
    getNavPointProgress(): Promise<NavPointProgress>

    /**
     * Jump to specified directory
     * @param navPoint navigation point to jump to
     */
    gotoNavPoint(navPoint: NavPoint): Promise<void>;

    /**
     * Jump to next directory or file (if there is a directory, use the directory first, otherwise jump to the next file)
     */
    gotoNextNavPointOrFile(): Promise<void>;

    /**
     * Jump to previous directory or file (if there is a directory, use the directory first, otherwise jump to the previous file)
     */
    gotoPreviousNavPointOrFile(): Promise<void>;

}

export type NavPointProgress = { total: number, current: number, type: 'file' | 'navpoint' }