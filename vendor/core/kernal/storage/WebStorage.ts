import localforage from 'localforage';
import { DataStorageOptions, IStorage } from './IStorage';
import { JsonConvert } from '../JsonConvert';

export class WebStorage implements IStorage {
    private tables: Map<string, LocalForage>;
    private defaultDbName: string;
    private tableDatas: Map<string, Map<string, any>>;
    private cached: Map<string, {
        /**Original string when caching (used for comparison to see if it has been modified) */
        origin: string,
        /**Cached value */
        current: any
    }> = new Map<string, { origin: string, current: any }>();
    private options?: DataStorageOptions
    constructor(options?: DataStorageOptions) {
        this.defaultDbName = options?.dbName ?? "linghuxiong_reader";
        this.tables = new Map<string, LocalForage>();
        this.tableDatas = new Map<string, Map<string, any>>();
        if (options?.useMemoryMinKeyCount) {
            if (options.useMemoryMinKeyCount < 1000) {
                options.useMemoryMinKeyCount = 1000;
            }
            if (!options.useMemoryMaxKeyCount) {
                options.useMemoryMaxKeyCount = 200000;
            }
        }
        this.options = options;
    }

    get dbName(): string {
        return this.defaultDbName;
    }

    async getString(tableName: string, key: string): Promise<string> {
        return await this.get<string>(tableName, key);
    }

    private saveCache(fullKey: string, value: any) {
        const json = JsonConvert.stringify(value)
        //Cache copy
        if (json?.length > 1024 * 1024) {
            //If the data is greater than 1M, it is not cached
            this.cached.delete(fullKey)
        }
        else {
            this.cached.set(fullKey, { origin: json, current: value });
        }
    }

    private getCache(fullKey: string) {
        if (this.cached.has(fullKey)) {
            const result = this.cached.get(fullKey);
            if (!result) {
                return { exist: true, content: null };
            }
            //Check if the cache is correct
            const origin = result.origin;
            const currentJson = JsonConvert.stringify(result.current)
            if (origin != currentJson) {
                //Cache has been modified
                // console.log('Cache has been modified', 'fullKey', fullKey)
                return { exist: false, content: null };
            }
            return { exist: true, content: result.current };
        }
        return { exist: false, content: null };
    }
    async get<T>(tableName: string, key: string): Promise<T | null> {
        key = this.formatKey(key);
        if (!key) {
            return null;
        }

        const table = await this.fetchTable(tableName, false);
        if (!table) {
            return null;
        }
        const fullKey = this.buildFullKey(tableName, key);
        const { exist, content } = this.getCache(fullKey);
        if (exist) {
            return content;
        }
        // console.log('get', tableName, key)
        const value = await table.getItem(key);

        //Cache copy
        this.saveCache(fullKey, value);

        return value as T;
    }

    async find<T>(tableName: string, predicate: (value: T, key: string, index: number) => boolean): Promise<T> {
        const table = await this.fetchTable(tableName, false);
        if (!table) {
            return null;
        }
        const fullTableName = this.buildFullTableName(tableName);
        let dataMap = this.tableDatas.get(fullTableName);
        if (dataMap) {
            let index = 0;
            for (const [key, value] of dataMap.entries()) {
                const r = predicate(value, key, index)
                if (r) {
                    return value;
                }
                index++;
            }
            return null;
        }

        const item = await table.iterate<T, T>((value, key, index) => {
            const r = predicate(value, key, index)
            if (r) {
                return value;
            }
        });
        return item;
    }

    async filter<T>(tableName: string, predicate: (value: T, key: string, index: number) => boolean): Promise<T[]> {
        const table = await this.fetchTable(tableName, false);
        if (!table) {
            return [];
        }
        // console.time('filter-' + tableName)
        const items: T[] = [];
        const fullTableName = this.buildFullTableName(tableName);
        let dataMap = this.tableDatas.get(fullTableName);
        if (!dataMap) {
            const dataCount = await this.getKeyCount(tableName);
            if (this.options?.useMemoryMinKeyCount
                && this.options?.useMemoryMaxKeyCount
                && dataCount >= (this.options?.useMemoryMinKeyCount ?? 0)
                && dataCount < (this.options?.useMemoryMaxKeyCount ?? 0)
            ) {
                dataMap = await this.getAll(tableName);
                this.tableDatas.set(fullTableName, dataMap);
            }
        }
        if (dataMap) {
            let index = 0;
            for (const [key, value] of dataMap.entries()) {
                const r = predicate(value, key, index)
                if (r) {
                    items.push(value)
                }
                index++;
            }
        }
        else {
            await table.iterate<T, void>((value, key, index) => {
                const r = predicate(value, key, index)
                if (r) {
                    items.push(value)
                }
                //Do not terminate the loop, must completely traverse
            });
        }
        // console.timeEnd('filter-' + tableName)
        return items;
    }

    async getAll<T>(tableName: string): Promise<Map<string, T>> {
        // let keys = await table.keys();
        // console.time(tableName)
        let keyValues: Map<string, T> = new Map<string, T>();
        const table = await this.fetchTable(tableName, false);
        if (!table) {
            return keyValues;
        }
        // console.time('getAll-' + tableName)
        const fullTableName = this.buildFullTableName(tableName);
        let dataMap = this.tableDatas.get(fullTableName);
        if (dataMap) {
            //Do not return dataMap directly, must reconstruct the map to prevent external changes to the data source
            keyValues = new Map<string, T>(dataMap.entries());
            // console.timeEnd('getAll-' + tableName)
            return keyValues;
        }
        await table.iterate<T, void>((value, key) => {
            keyValues.set(key, value);
        });
        const dataCount = await this.getKeyCount(tableName);
        if (this.options?.useMemoryMinKeyCount
            && this.options?.useMemoryMaxKeyCount
            && dataCount >= (this.options?.useMemoryMinKeyCount ?? 0)
            && dataCount < (this.options?.useMemoryMaxKeyCount ?? 0)
        ) {
            this.tableDatas.set(fullTableName, keyValues);
        }
        // console.timeEnd('getAll-' + tableName)
        return keyValues;
    }

    async set<T>(tableName: string, key: string, content: T, from?: 'local' | 'server'): Promise<void> {

        const table = await this.fetchTable(tableName, true);
        if (!table) {
            return;
        }

        key = this.formatKey(key);

        if (!key || key == 'undefined') {
            return;
        }
        const cacheKey = this.buildFullKey(tableName, key);
        try {
            if (this.cached.has(cacheKey)) {
                const origin = this.cached.get(cacheKey)?.origin;
                if (JsonConvert.stringify(content) === origin) {
                    //If the cache already has the same value, do not set it again
                    return;
                }
            }

        } catch (e) {
            //
        }
        // console.log('set', tableName, key, content)
        const fullTableName = this.buildFullTableName(tableName);
        const dataMap = this.tableDatas.get(fullTableName);
        if (dataMap) {
            dataMap.set(key, content);
        }
        //Cache copy
        this.saveCache(cacheKey, content);

        await table.setItem(key, content);
    }

    async delete(tableName: string, key: string, from?: 'local' | 'server'): Promise<void> {
        const table = await this.fetchTable(tableName, false);
        if (!table) {
            return;
        }
        key = this.formatKey(key);
        if (!key) {
            return;
        }
        const fullTableName = this.buildFullTableName(tableName);
        const dataMap = this.tableDatas.get(fullTableName);
        if (dataMap) {
            dataMap.delete(key);
        }
        this.cached.delete(this.buildFullKey(tableName, key));
        await table.removeItem(key);

    }

    async getKeyCount(tableName: string): Promise<number> {
        const table = await this.fetchTable(tableName, false);
        if (!table) {
            return 0;
        }
        return await table.length();
    }

    async dropDb(): Promise<void> {
        this.tables.clear();
        this.tableNames.splice(0)
        this.tableDatas.clear();
        await localforage.dropInstance({ name: this.dbName });
    }

    async dropTable(tableName: string): Promise<void> {
        // const lowerTableName = tableName.toLowerCase();
        // const fullDbName = this.dbName + lowerTableName;
        // this.tables.delete(fullDbName);
        // await localforage.dropInstance({ name: this.dbName, storeName: lowerTableName });
        const fullTableName = this.buildFullTableName(tableName);
        this.tableDatas.delete(fullTableName);

        //Do not delete the instance directly, otherwise an error will occur when loading the db, change to empty data的方式
        const table = await this.fetchTable(tableName, false);
        if (!table) {
            return;
        }
        // console.log('dropTable',tableName,'keys length',await table.length())
        await table.clear();
    }

    async getTableNames() {
        const currentTableNames = await this.internalGetTableNames();
        //Must clone here, otherwise external changes to the collection will cause the data to be queried
        return [...currentTableNames];
    }

    private tableNames: string[] = [];
    private async internalGetTableNames() {
        if (this.tableNames && this.tableNames.length > 0) {
            return this.tableNames;
        }
        const dbRequest = globalThis.indexedDB.open(this.dbName);
        this.tableNames = await new Promise<string[]>((resolve, reject) => {
            const tableNames: string[] = []
            dbRequest.onsuccess = () => {
                const db = dbRequest.result;
                tableNames.push(...db.objectStoreNames);
                db.close();
                resolve(tableNames);
            };
            dbRequest.onerror = () => {
                reject('Unable open database')
            }
        })
        // console.log('getTableNames', this.tableNames)
        return this.tableNames;
    }

    /**
     * Get table
     * @param tableName 
     * @param createIfNotExist Create if it does not exist (each LocalForage instance represents a table)
     * @returns 
     */
    private async fetchTable(tableName: string, createIfNotExist: boolean): Promise<LocalForage> {
        // console.log('fetchTable', tableName)
        const lowerTableName = tableName.toLowerCase();
        const fullDbName = this.dbName + lowerTableName;
        let table: LocalForage;
        if (this.tables.has(fullDbName)) {
            table = this.tables.get(fullDbName);
        }
        else {
            const tableNames = await this.internalGetTableNames();
            if (tableNames.includes(lowerTableName) || createIfNotExist) {
                table = localforage.createInstance({ driver: localforage.INDEXEDDB, name: this.dbName, storeName: lowerTableName });
                if (!this.tableNames.includes(lowerTableName)) {
                    this.tableNames.push(lowerTableName);
                }
                this.tables.set(fullDbName, table);
            }
        }

        if (!table) {
            return null;
        }
        return table;
    }

    private buildFullTableName(tableName: string) {
        const lowerTableName = tableName.toLowerCase();
        return this.dbName + lowerTableName;
    }

    private formatKey(key: string) {
        if (typeof key === 'number') {
            return (key as any).toString();
        }
        if (key == 'undefined') {
            return undefined;
        }
        return key;
    }

    private buildFullKey(tableName: string, key: string) {
        const lowerTableName = tableName.toLowerCase();
        return this.dbName + lowerTableName + '-' + key;
    }

    async dispose(): Promise<void> {
        if (this.tables) {
            this.tables.clear();
        }
        if (this.cached) {
            this.cached.clear();
        }
        if (this.tableDatas) {
            this.tableDatas.clear();
        }
    }
}