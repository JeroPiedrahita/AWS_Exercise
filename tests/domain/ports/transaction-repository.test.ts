import { createMockTransactionRepository } from '../../__mocks__/transaction-repository.mock';
import { Transaction } from '@/domain/entities/transaction';
import { TransactionStatus } from '@/domain/constants/transaction-status';

describe('ITransactionRepository (Port Contract)', () => {
    it('should expose save method that accepts a Transaction and returns Promise<void>', async () => {
        const mockRepo = createMockTransactionRepository();
        mockRepo.save.mockResolvedValue(undefined);

        const transaction = new Transaction('txn-001', 'acc-001', 100, TransactionStatus.COMPLETED, new Date());
        const result = await mockRepo.save(transaction);

        expect(mockRepo.save).toHaveBeenCalledWith(transaction);
        expect(result).toBeUndefined();
    });

    it('should expose getById method that returns Promise<Transaction | null>', async () => {
        const mockRepo = createMockTransactionRepository();
        const expectedTransaction = new Transaction('txn-001', 'acc-001', 50, TransactionStatus.PENDING, new Date());
        mockRepo.getById.mockResolvedValue(expectedTransaction);

        const result = await mockRepo.getById('txn-001');

        expect(mockRepo.getById).toHaveBeenCalledWith('txn-001');
        expect(result).toBe(expectedTransaction);
    });

    it('should expose getById method that can return null when transaction not found', async () => {
        const mockRepo = createMockTransactionRepository();
        mockRepo.getById.mockResolvedValue(null);

        const result = await mockRepo.getById('non-existent');

        expect(result).toBeNull();
    });

    it('should expose getTransactionsBetweenDates method that returns Promise<Transaction[]>', async () => {
        const mockRepo = createMockTransactionRepository();
        const transactions = [
            new Transaction('txn-001', 'acc-001', 100, TransactionStatus.COMPLETED, new Date()),
            new Transaction('txn-002', 'acc-002', 200, TransactionStatus.COMPLETED, new Date()),
        ];
        mockRepo.getTransactionsBetweenDates.mockResolvedValue(transactions);

        const startDate = new Date('2024-01-01T00:00:00Z');
        const endDate = new Date('2024-01-31T23:59:59Z');
        const result = await mockRepo.getTransactionsBetweenDates(startDate, endDate);

        expect(mockRepo.getTransactionsBetweenDates).toHaveBeenCalledWith(startDate, endDate);
        expect(result).toEqual(transactions);
        expect(result).toHaveLength(2);
    });

    it('should implement all methods defined in the ITransactionRepository interface', () => {
        const mockRepo = createMockTransactionRepository();

        expect(mockRepo).toHaveProperty('save');
        expect(mockRepo).toHaveProperty('getById');
        expect(mockRepo).toHaveProperty('getTransactionsBetweenDates');
        expect(typeof mockRepo.save).toBe('function');
        expect(typeof mockRepo.getById).toBe('function');
        expect(typeof mockRepo.getTransactionsBetweenDates).toBe('function');
    });
});
