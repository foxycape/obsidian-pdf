export interface IFileProvider {
    /**
     * Get file
     * @param key Remote file path or path relative to the package root
     * @param parentUrl Parent file path
     * @returns ArrayBuffer
     */
    getFile(key: string, parentUrl?: string): Promise<ArrayBuffer>;
}