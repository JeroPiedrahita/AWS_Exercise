import { FileStorage } from '@/application/ports/file-storage';

export function createMockFileStorage(): jest.Mocked<FileStorage> {
    return {
        save: jest.fn(),
    };
}
