import { isNullOrWhiteSpace } from './text';

const flattenTreeItem = (flatData: any[], item: any, childrenName: string) => {
    if (item[childrenName] && item[childrenName].length > 0) {
        item[childrenName].forEach((n: any) => {
            flattenTreeItem(flatData, n, childrenName);
        });
    } else {
        flatData.push(item);
    }
};

/**
 * Flatten a tree structure
 */
export const flattenTree = (items: any[], childrenName: string) => {
    if (isNullOrWhiteSpace(childrenName)) return [];
    const flatData: any[] = [];
    items.forEach((n: any) => {
        flattenTreeItem(flatData, n, childrenName);
    });
    return flatData;
};
