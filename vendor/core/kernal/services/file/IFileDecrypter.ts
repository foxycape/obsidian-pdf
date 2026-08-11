
export interface IFileDecrypter {
    /**
     * Decrypt file
     * @param file Decrypt file
     * @returns Decrypted file
     */
    decrypt(file: DecryptFile): Promise<Uint8Array>;
}

export class DecryptFile {
    /**
     * Constructor
     * @param extension Extension name
     * @param data Data
     * @param url File URL
     */
    constructor(public readonly extension: string, public readonly data: Uint8Array, public readonly url: string | undefined = undefined) {

    }
    parent: DecryptParentFile | undefined;
    /**Custom decryption key */
    key?: string;
}

export class DecryptParentFile {
    /**
     * Constructor
     * @param extension Extension name
     * @param url File URL
     */
    constructor(public readonly extension: string, public readonly url?: string) { }
}
