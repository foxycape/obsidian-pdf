import { digestStream, type DigestSource } from './hash';

/** MD5 hex digest. Blob and File inputs are read in chunks. */
export const computeMd5 = async (data: DigestSource): Promise<string> => {
    return digestStream(data, 'MD5');
};
