import { Transaction } from '@/domain/entities/transaction';
import { TransactionStatus } from '@/domain/constants/transaction-status';
import { createValidTransaction } from '../../fixtures/transaction.fixtures';

describe('Transaction', () => {
    it('should create Transaction with valid positive amount and verify all properties match constructor parameters', () => {
        const id = 'txn-001';
        const accountId = 'acc-001';
        const amount = 100;
        const status = TransactionStatus.COMPLETED;
        const createdAt = new Date('2024-01-15T10:00:00Z');

        const transaction = new Transaction(id, accountId, amount, status, createdAt);

        expect(transaction.id).toBe(id);
        expect(transaction.accountId).toBe(accountId);
        expect(transaction.amount).toBe(amount);
        expect(transaction.status).toBe(status);
        expect(transaction.createdAt).toBe(createdAt);
    });

    it('should throw error with message "El monto de la transacción debe ser mayor a cero." when amount is zero', () => {
        expect(() => createValidTransaction({ amount: 0 })).toThrow(
            'El monto de la transacción debe ser mayor a cero.'
        );
    });

    it('should throw error with message "El monto de la transacción debe ser mayor a cero." when amount is negative', () => {
        expect(() => createValidTransaction({ amount: -50 })).toThrow(
            'El monto de la transacción debe ser mayor a cero.'
        );
    });

    it('should accept each valid TransactionStatus value (PENDING, COMPLETED, FAILED)', () => {
        const statuses: Array<keyof typeof TransactionStatus> = [
            TransactionStatus.PENDING,
            TransactionStatus.COMPLETED,
            TransactionStatus.FAILED,
        ];

        statuses.forEach((status) => {
            const transaction = createValidTransaction({ status });
            expect(transaction.status).toBe(status);
        });
    });

    it('should assign properties as readonly from constructor parameters', () => {
        const id = 'txn-readonly';
        const accountId = 'acc-readonly';
        const amount = 250;
        const status = TransactionStatus.PENDING;
        const createdAt = new Date('2024-06-01T12:00:00Z');

        const transaction = new Transaction(id, accountId, amount, status, createdAt);

        // Verify all properties are correctly assigned from constructor
        expect(transaction.id).toBe(id);
        expect(transaction.accountId).toBe(accountId);
        expect(transaction.amount).toBe(amount);
        expect(transaction.status).toBe(status);
        expect(transaction.createdAt).toBe(createdAt);

        // TypeScript enforces readonly at compile time via @ts-expect-error:
        // If any of these lines stop producing a TS error, the test will fail to compile,
        // proving the properties are declared as readonly.
        // @ts-expect-error - readonly property cannot be reassigned
        transaction.id = 'other';
        // @ts-expect-error - readonly property cannot be reassigned
        transaction.accountId = 'other';
        // @ts-expect-error - readonly property cannot be reassigned
        transaction.amount = 0;
        // @ts-expect-error - readonly property cannot be reassigned
        transaction.status = TransactionStatus.FAILED;
        // @ts-expect-error - readonly property cannot be reassigned
        transaction.createdAt = new Date();
    });
});
