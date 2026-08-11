import { Progress } from "./Progress";

/**
 * Reading progress query and update.
 */
export interface IProgressTracker {
    /**
     * Get progress
     * @param precise whether to get precise progress
     */
    getProgress(precise?: boolean): Promise<Progress>;
}
