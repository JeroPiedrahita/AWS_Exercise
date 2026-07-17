import { FileStorage } from "../../domain/ports/file-storage";
import {PutObjectCommand, S3Client} from "@aws-sdk/client-s3";
/**
 * Amazon S3 implementation of the file storage port.
 * Responsible for persisting generated files in
 * an S3 bucket
 */
export class S3FileStorage implements FileStorage {
    private readonly client: S3Client;
    private readonly bucketName ="transacciones-reportes-303040220363";

    constructor() {
        this.client = new S3Client({
            region: "us-east-1"
        });
    }
/**
 * Uploads a file to Amazon S3.
 * 
 * @param fileName Name of the file to store. 
 * @param fileContent  File content as a buffer.
 * 
 * @returns A promise that resolves when the file has been successfully upload.
 */
    async save(
        fileName: string,
        fileContent: Buffer,
    ): Promise<void> {

        await this.client.send(
            new PutObjectCommand({
                Bucket: this.bucketName,
                Key: fileName,
                Body: fileContent
            })
        )

    }
}