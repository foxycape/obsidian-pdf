import { isNullOrWhiteSpace } from "./text";

/**
 * Extract a number (all digits and decimal points from the string)
 */
export const extractNumber = (value: string, defaultValue: number): number => {
    if (isNullOrWhiteSpace(value))
        return defaultValue;
    const matchResult = value.match(/[0-9.]+/ig);
    const firstValue = matchResult?.[0];
    if (!firstValue)
        return defaultValue;
    const result = parseFloat(firstValue);
    if (isNumber(result)) {
        return result
    }
    return defaultValue;
};

/**
 * Strictly parse a float number
 */
export const parseFloatStrict = (value: string) => {
    if (!value) {
        return NaN;
    }
    if (typeof value === 'string') {
        value = value.trim();
        if (/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(value)) {
            return parseFloat(value);
        }
    }
    else if (typeof value === 'number') {
        return value;
    }

    return NaN;
};

export const parseIntStrict = (value: string, radix = 10) => {
    if (!value) {
        return NaN;
    }
    if (typeof value === 'string') {
        value = value.trim();

        let pattern: RegExp;
        switch (radix) {
            case 10:
                pattern = /^[+-]?\d+$/;
                break;
            case 16:
                pattern = /^[+-]?[0-9A-Fa-f]+$/;
                break;
            case 8:
                pattern = /^[+-]?[0-7]+$/;
                break;
            case 2:
                pattern = /^[+-]?[01]+$/;
                break;
            default:
                return NaN;
        }

        if (pattern.test(value)) {
            return parseInt(value, radix);
        }
    }
    else if (typeof value === 'number') {
        return value;
    }

    return NaN;
};

/** Check whether the value is a finite number */
export const isNumber = (value: string | number) => {
    if (typeof value == "string") {
        return isFinite(parseFloatStrict(value))
    }
    if (typeof value == "number") {
        return isFinite(value)
    }
    return false;
};

/**
 * Parse a number
 */
export const parseNumber = (value: string, defaultValue: number, method?: 'parseFloat' | 'parseInt'): number => {
    let result: number;
    if (method == 'parseInt') {
        result = parseIntStrict(value);
    }
    else {
        result = parseFloatStrict(value);
    }
    if (isNumber(result)) {
        return result
    }
    return defaultValue;
};
