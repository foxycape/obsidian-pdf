import { OpenOptions } from "../../OpenOptions";

export interface IFileUrlProvider{
    /**
     * get the url of the file
     * @param reader 
     * @param openOptions 
     * @returns the url string | ArrayBuffer | FilePackage | Blob | FileSystemFileHandle | undefined
     */
    getUrl(openOptions: OpenOptions): Promise<any>;
}