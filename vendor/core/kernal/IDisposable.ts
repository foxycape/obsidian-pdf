export interface IDisposable {
    /**
     * Destroy object
     */
    dispose(): Promise<void>;
}