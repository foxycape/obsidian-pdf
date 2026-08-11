export const containValues = (array: any[]) => {
    const count = array?.length ?? 0;
    return count > 0;
};

/**
 * Remove all items from an array that match the given predicate
 */
export const removeAll = <T,>(
    source: Array<T>,
    predicate: (value: T, index: number, array: T[]) => unknown,
    thisArg?: any
) => {
    if (!source || source.length == 0) return;
    const values = source.filter(predicate, thisArg);
    for (let i = 0; i < values.length; i++) {
        const index = source.indexOf(values[i]);
        if (index >= 0) {
            source.splice(index, 1);
        }
    }
};

/**
 * Sum array values
 */
export const sum = (array: number[]) => {
    if (!array || array.length == 0) {
        return 0;
    }
    return array.reduce((prev, curr) => {
        return prev + curr;
    });
};
