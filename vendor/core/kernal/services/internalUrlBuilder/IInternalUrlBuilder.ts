export interface IInternalUrlBuilder{    
    getAbsoluteUrl(relativeUrl: string, ignoreHash?: boolean): Promise<string>
}