import { deepcopy } from "../deepClone";

/**
 * Deep clone an object
 */
export const deepClone = <T,>(obj: T, compatibilityPriority?: boolean): T => {
    if (obj == null || obj == undefined) {
        return obj as T;
    }

    if (!compatibilityPriority && globalThis.structuredClone) {
        try {
            return structuredClone<T>(obj)
        } catch (e) {
            console.log('structuredClone', e);
        }
    }

    return deepcopy(obj) as T
};

/**
 * Convert JSON object field names to camelCase
 */
export const convertJsonToCamelcase = (json: object) => {
    if (Array.isArray(json)) {
        json.forEach((item) => {
            convertJsonToCamelcase(item);
        })
    } else {
        for (const key in json) {
            const item = json[key];
            if (typeof item == 'object') {
                convertJsonToCamelcase(item);
            }
            delete (json[key]);
            json[key.substring(0, 1).toLocaleLowerCase() + key.substring(1)] = item;
        }
    }
};
