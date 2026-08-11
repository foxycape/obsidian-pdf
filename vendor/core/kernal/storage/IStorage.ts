import { IDisposable } from "../IDisposable";

export interface IStorage extends IDisposable {
    get dbName(): string;
    get<T>(tableName: string, key: string): Promise<T>;

    getString(tableName: string, key: string): Promise<string>;

    find<T>(tableName: string, predicate: (value: T, key: string, index: number) => boolean): Promise<T>;

    filter<T>(tableName: string, predicate: (value: T, key: string, index: number) => boolean): Promise<T[]>;

    getAll<T>(tableName: string): Promise<Map<string, T>>;

    set<T>(tableName: string, key: string, content: T,from?:'local'|'server'): Promise<void>;

    getKeyCount(tableName: string): Promise<number>

    delete(tableName: string, key: string,from?:'local'|'server'): Promise<void>

    dropDb(): Promise<void>;

    dropTable(tableName: string): Promise<void>;

    getTableNames(): Promise<string[]>;
}

export class DataStorageOptions {
    /**Minimum number of keys per table for in-memory usage (minimum 1000) */
    useMemoryMinKeyCount?: number;

    /**Maximum number of keys per table for in-memory usage (maximum 200000) */
    useMemoryMaxKeyCount?: number;

    /**Database name. If not specified, the default database name is used. */
    dbName?: string;
}