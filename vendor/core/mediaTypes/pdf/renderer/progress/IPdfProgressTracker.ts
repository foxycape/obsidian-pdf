import type { IProgressTracker, IDisposable } from "../../../../kernal";

export interface IPdfProgressTracker extends IProgressTracker, IDisposable {
    /**
     * Update progress from page-changing events.
     */
    updateFromPageChange(): void;
};
