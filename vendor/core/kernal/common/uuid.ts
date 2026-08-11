import XXH from 'xxhashjs';

const xxhash = XXH.h64(20220919101915);

/**
 * Compute a unique id of the given string.
 * @param content The string to hash
 */
export const computeUniqueId = (content: string): string => {
    return xxhash.update(content).digest().toString(16);
};

const getFastUniqueId = (): string => {
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
    return uuid;
};

/**
 * Get a UUID
 * @param fastUID Whether to use a fast UUID; enable this when many UUIDs are needed in a short time for better performance
 */
export const getUuid = (fastUID?: boolean): string => {
    let uuid: string;
    const canCreateObjectURL =
        typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';

    if (!canCreateObjectURL || fastUID) {
        uuid = getFastUniqueId();
    }
    else {
        const url = URL.createObjectURL(new Blob());
        try {
            const [id] = url.toString().split('/').reverse();
            uuid = id;
            if (uuid.indexOf("blob:") >= 0) {
                uuid = uuid.replace("blob:", "");
            }
        } catch (e) {
            uuid = getFastUniqueId();
        }
        finally {
            URL.revokeObjectURL(url);
        }
    }

    if (!uuid) {
        throw new Error("Failed to create uuid");
    }
    return uuid.replace(/[-]+/gi, "");
};

/**
 * Generate a random id
 */
export const getRandomId = (fastUID?: boolean) => {
    return "r" + getUuid(fastUID);
};
