import { Transaction } from '@/domain/entities/transaction';
import { TransactionStatus } from '@/domain/constants/transaction-status';

export function createValidTransaction(overrides?: Partial<{
    id: string;
    accountId: string;
    amount: number;
    status: keyof typeof TransactionStatus;
    createdAt: Date;
}>): Transaction {
    return new Transaction(
        overrides?.id ?? 'txn-001',
        overrides?.accountId ?? 'acc-001',
        overrides?.amount ?? 100,
        overrides?.status ?? TransactionStatus.COMPLETED,
        overrides?.createdAt ?? new Date('2024-01-15T10:00:00Z')
    );
}

export function createTransactionList(count: number): Transaction[] {
    return Array.from({ length: count }, (_, i) =>
        createValidTransaction({
            id: `txn-${String(i + 1).padStart(3, '0')}`,
            accountId: `acc-${String(i + 1).padStart(3, '0')}`,
            amount: (i + 1) * 50,
        })
    );
}
