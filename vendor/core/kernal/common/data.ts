/**
 * Format file size for UI display
 */
export const formatFileSize = (filesize: number, unknownValue?: string): string => {
    if (typeof filesize !== "number" || filesize == null || !Number.isFinite(filesize) || filesize < 0) {
        return unknownValue ?? 'Unknown';
    }
    if (filesize == 0) {
        return '0 B'
    }
    const unitArray = new Array("Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB");
    const index = Math.floor(Math.log(filesize) / Math.log(1024));
    if (index < 0 || index >= unitArray.length) {
        return unknownValue ?? 'Unknown';
    }
    const size = filesize / Math.pow(1024, index);
    if (filesize <= 1024) {
        return size.toFixed(0) + " " + unitArray[index];
    }
    else {
        return size.toFixed(2) + " " + unitArray[index];
    }
};
