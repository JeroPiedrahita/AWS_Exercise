import { ProcessPaymentUseCase } from '@/application/process-payment.use-cases';
import { ITransactionRepository } from '@/domain/ports/transaction-repository';
import { Transaction } from '@/domain/entities/transaction';
import { createMockTransactionRepository } from '../__mocks__/transaction-repository.mock';
import { TransactionStatus } from '@/domain/constants/transaction-status';

describe('ProcessPaymentUseCase', () => {
    let useCase: ProcessPaymentUseCase;
    let mockRepository: jest.Mocked<ITransactionRepository>;

    beforeEach(() => {
        mockRepository = createMockTransactionRepository();
        useCase = new ProcessPaymentUseCase(mockRepository);
    });

    it('should call repository.save with a Transaction containing the provided id, accountId, amount, status "COMPLETED", and a createdAt Date when execute is called with valid parameters', async () => {
        const id = 'txn-001';
        const accountId = 'acc-001';
        const amount = 150;

        await useCase.execute(id, accountId, amount);

        expect(mockRepository.save).toHaveBeenCalledTimes(1);

        const savedTransaction = mockRepository.save.mock.calls[0]![0];

        expect(savedTransaction).toBeInstanceOf(Transaction);
        expect(savedTransaction.id).toBe(id);
        expect(savedTransaction.accountId).toBe(accountId);
        expect(savedTransaction.amount).toBe(amount);
        expect(savedTransaction.status).toBe(TransactionStatus.COMPLETED);
        expect(savedTransaction.createdAt).toBeInstanceOf(Date);
    });

    it('should pass correct parameters to repository.save', async () => {
        const id = 'txn-002';
        const accountId = 'acc-002';
        const amount = 250;

        await useCase.execute(id, accountId, amount);

        expect(mockRepository.save).toHaveBeenCalledWith(
            expect.objectContaining({
                id,
                accountId,
                amount,
                status: TransactionStatus.COMPLETED,
            })
        );
    });
});
