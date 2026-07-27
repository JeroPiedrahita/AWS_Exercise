import {Buffer} from "buffer"
/**
 * Defines the contract for storing files.
 */

export interface FileStorage{
    /**
     * Stores a file in the configured storage service.
     * @param fileName Name of the file.
     * @param content File content.
     */
    save(fileName: string, fileContent: Buffer): Promise<void>;

}