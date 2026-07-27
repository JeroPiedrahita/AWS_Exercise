import { GetTransactionUseCase } from '@/application/get-transaction.use-case';
import { ITransactionRepository } from '@/domain/ports/transaction-repository';
import { TransactionNotFoundError } from '@/domain/exceptions/transaction-not-found.error';
import { createMockTransactionRepository } from '../__mocks__/transaction-repository.mock';
import { createValidTransaction } from '../fixtures/transaction.fixtures';

describe('GetTransactionUseCase', () => {
    let useCase: GetTransactionUseCase;
    let mockRepository: jest.Mocked<ITransactionRepository>;

    beforeEach(() => {
        mockRepository = createMockTransactionRepository();
        useCase = new GetTransactionUseCase(mockRepository);
    });

    it('should return transaction when repository.getById returns a transaction', async () => {
        const transaction = createValidTransaction({ id: 'txn-001' });
        mockRepository.getById.mockResolvedValue(transaction);

        const result = await useCase.execute({ id: 'txn-001' });

        expect(mockRepository.getById).toHaveBeenCalledWith('txn-001');
        expect(result).toEqual(transaction);
    });

    it('should throw TransactionNotFoundError when repository.getById returns null', async () => {
        mockRepository.getById.mockResolvedValue(null);

        await expect(useCase.execute({ id: 'non-existent-id' })).rejects.toThrow(TransactionNotFoundError);
        expect(mockRepository.getById).toHaveBeenCalledWith('non-existent-id');
    });
});
