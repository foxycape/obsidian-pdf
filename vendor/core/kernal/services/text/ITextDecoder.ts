export interface ITextDecoder{
    /**
     * decode the text to a unicode string
     * @param text The text to decode   
     * @param options 
     */
    decode(text:ArrayBuffer,options?:any):Promise<string>;
}