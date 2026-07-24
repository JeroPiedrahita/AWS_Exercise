import { PutObjectCommand } from '@aws-sdk/client-s3';
import { S3FileStorage } from '@/infrastructure/outputs/s3filestorage';

jest.mock('@aws-sdk/client-s3', () => {
    const actual = jest.requireActual('@aws-sdk/client-s3');
    return {
        ...actual,
        S3Client: jest.fn().mockImplementation(() => ({
            send: jest.fn(),
        })),
    };
});

describe('S3FileStorage', () => {
    let storage: S3FileStorage;
    let mockSend: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        storage = new S3FileStorage();
        mockSend = (storage as any).client.send;
    });

    it('should call S3 PutObjectCommand with correct bucket, key, and body', async () => {
        mockSend.mockResolvedValue({});
        const fileName = 'reporte-2024-01-15.xlsx';
        const fileContent = Buffer.from('fake-excel-content');

        await storage.save(fileName, fileContent);

        expect(mockSend).toHaveBeenCalledTimes(1);
        const command = mockSend.mock.calls[0][0];
        expect(command).toBeInstanceOf(PutObjectCommand);
        expect(command.input).toEqual({
            Bucket: 'transacciones-reportes-303040220363',
            Key: fileName,
            Body: fileContent,
        });
    });

    it('should resolve successfully when S3 upload succeeds', async () => {
        mockSend.mockResolvedValue({});

        await expect(
            storage.save('test-file.xlsx', Buffer.from('content'))
        ).resolves.toBeUndefined();
    });

    it('should propagate errors from S3 client', async () => {
        mockSend.mockRejectedValue(new Error('Access Denied'));

        await expect(
            storage.save('test-file.xlsx', Buffer.from('content'))
        ).rejects.toThrow('Access Denied');
    });
});
