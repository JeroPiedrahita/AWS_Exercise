import { ITransactionRepository } from '@/domain/ports/transaction-repository';

export function createMockTransactionRepository(): jest.Mocked<ITransactionRepository> {
    return {
        save: jest.fn(),
        getById: jest.fn(),
        getTransactionsBetweenDates: jest.fn(),
    };
}
