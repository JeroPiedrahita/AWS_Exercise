import { FileStorage } from '@/domain/ports/file-storage';

export function createMockFileStorage(): jest.Mocked<FileStorage> {
    return {
        save: jest.fn(),
    };
}
