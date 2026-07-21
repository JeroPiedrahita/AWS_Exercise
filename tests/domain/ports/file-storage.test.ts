import { createMockFileStorage } from '../../__mocks__/file-storage.mock';

describe('FileStorage (Port Contract)', () => {
    it('should expose save method that accepts fileName and Buffer content and returns Promise<void>', async () => {
        const mockStorage = createMockFileStorage();
        mockStorage.save.mockResolvedValue(undefined);

        const fileName = 'reporte-2024-01-15.xlsx';
        const fileContent = Buffer.from('fake-file-content');

        const result = await mockStorage.save(fileName, fileContent);

        expect(mockStorage.save).toHaveBeenCalledWith(fileName, fileContent);
        expect(result).toBeUndefined();
    });

    it('should accept any valid file name string', async () => {
        const mockStorage = createMockFileStorage();
        mockStorage.save.mockResolvedValue(undefined);

        const fileNames = [
            'reporte-2024-01-01.xlsx',
            'report-with-special_chars.csv',
            'simple.txt',
        ];

        for (const fileName of fileNames) {
            await mockStorage.save(fileName, Buffer.from('content'));
            expect(mockStorage.save).toHaveBeenCalledWith(fileName, expect.any(Buffer));
        }
    });

    it('should implement all methods defined in the FileStorage interface', () => {
        const mockStorage = createMockFileStorage();

        expect(mockStorage).toHaveProperty('save');
        expect(typeof mockStorage.save).toBe('function');
    });
});
