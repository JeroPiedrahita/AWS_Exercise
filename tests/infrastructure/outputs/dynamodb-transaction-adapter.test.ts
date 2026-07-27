import { PutItemCommand, GetItemCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { DynamonDBTransactionAdapter } from '@/infrastructure/outputs/dynamondb-transaction-adapter';
import { createValidTransaction } from '../../fixtures/transaction.fixtures';
import { TransactionStatus } from '@/domain/constants/transaction-status';

jest.mock('@aws-sdk/client-dynamodb', () => {
    const actual = jest.requireActual('@aws-sdk/client-dynamodb');
    return {
        ...actual,
        DynamoDBClient: jest.fn().mockImplementation(() => ({
            send: jest.fn(),
        })),
    };
});

describe('DynamonDBTransactionAdapter', () => {
    let adapter: DynamonDBTransactionAdapter;
    let mockSend: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        adapter = new DynamonDBTransactionAdapter();
        // Access the mocked client's send method
        mockSend = (adapter as any).client.send;
    });

    describe('save', () => {
        it('should call DynamoDB PutItemCommand with correct parameters', async () => {
            mockSend.mockResolvedValue({});
            const transaction = createValidTransaction();

            await adapter.save(transaction);

            expect(mockSend).toHaveBeenCalledTimes(1);
            const command = mockSend.mock.calls[0][0];
            expect(command).toBeInstanceOf(PutItemCommand);
            expect(command.input).toEqual({
                TableName: 'TransaccionesBancariasDev',
                Item: {
                    id: { S: transaction.id },
                    accountId: { S: transaction.accountId },
                    amount: { N: transaction.amount.toString() },
                    status: { S: transaction.status },
                    createdAt: { S: transaction.createdAt.toISOString() },
                },
            });
        });

        it('should propagate errors from DynamoDB client', async () => {
            mockSend.mockRejectedValue(new Error('DynamoDB connection failed'));
            const transaction = createValidTransaction();

            await expect(adapter.save(transaction)).rejects.toThrow('DynamoDB connection failed');
        });
    });

    describe('getById', () => {
        it('should return a Transaction when item exists with all fields', async () => {
            const date = new Date('2024-01-15T10:00:00Z');
            mockSend.mockResolvedValue({
                Item: {
                    id: { S: 'txn-001' },
                    accountId: { S: 'acc-001' },
                    amount: { N: '100' },
                    status: { S: 'COMPLETED' },
                    createdAt: { S: date.toISOString() },
                },
            });

            const result = await adapter.getById('txn-001');

            expect(mockSend).toHaveBeenCalledTimes(1);
            const command = mockSend.mock.calls[0][0];
            expect(command).toBeInstanceOf(GetItemCommand);
            expect(command.input).toEqual({
                TableName: 'TransaccionesBancariasDev',
                Key: { id: { S: 'txn-001' } },
            });

            expect(result).not.toBeNull();
            expect(result!.id).toBe('txn-001');
            expect(result!.accountId).toBe('acc-001');
            expect(result!.amount).toBe(100);
            expect(result!.status).toBe(TransactionStatus.COMPLETED);
            expect(result!.createdAt).toEqual(date);
        });

        it('should return null when Item is not present in response', async () => {
            mockSend.mockResolvedValue({ Item: undefined });

            const result = await adapter.getById('non-existent');

            expect(result).toBeNull();
        });

        it('should return null when item is missing required fields', async () => {
            mockSend.mockResolvedValue({
                Item: {
                    id: { S: 'txn-001' },
                    accountId: { S: 'acc-001' },
                    // missing amount, status, createdAt
                },
            });

            const result = await adapter.getById('txn-001');

            expect(result).toBeNull();
        });

        it('should propagate errors from DynamoDB client', async () => {
            mockSend.mockRejectedValue(new Error('Throttling'));

            await expect(adapter.getById('txn-001')).rejects.toThrow('Throttling');
        });
    });

    describe('getTransactionsBetweenDates', () => {
        it('should call ScanCommand with correct filter expression and return transactions', async () => {
            const startDate = new Date('2024-01-15T00:00:00.000Z');
            const endDate = new Date('2024-01-15T23:59:59.999Z');

            mockSend.mockResolvedValue({
                Items: [
                    {
                        id: { S: 'txn-001' },
                        accountId: { S: 'acc-001' },
                        amount: { N: '100' },
                        status: { S: 'COMPLETED' },
                        createdAt: { S: '2024-01-15T10:00:00.000Z' },
                    },
                    {
                        id: { S: 'txn-002' },
                        accountId: { S: 'acc-002' },
                        amount: { N: '200' },
                        status: { S: 'PENDING' },
                        createdAt: { S: '2024-01-15T14:00:00.000Z' },
                    },
                ],
            });

            const result = await adapter.getTransactionsBetweenDates(startDate, endDate);

            expect(mockSend).toHaveBeenCalledTimes(1);
            const command = mockSend.mock.calls[0][0];
            expect(command).toBeInstanceOf(ScanCommand);
            expect(command.input).toEqual({
                TableName: 'TransaccionesBancariasDev',
                FilterExpression: 'createdAt >= :startDate AND createdAt <= :endDate',
                ExpressionAttributeValues: {
                    ':startDate': { S: startDate.toISOString() },
                    ':endDate': { S: endDate.toISOString() },
                },
            });

            expect(result).toHaveLength(2);
            expect(result[0]!.id).toBe('txn-001');
            expect(result[0]!.amount).toBe(100);
            expect(result[1]!.id).toBe('txn-002');
            expect(result[1]!.amount).toBe(200);
        });

        it('should return empty array when Items is null or undefined', async () => {
            mockSend.mockResolvedValue({ Items: undefined });

            const startDate = new Date('2024-01-15T00:00:00.000Z');
            const endDate = new Date('2024-01-15T23:59:59.999Z');

            const result = await adapter.getTransactionsBetweenDates(startDate, endDate);

            expect(result).toEqual([]);
        });

        it('should return empty array when Items is an empty array', async () => {
            mockSend.mockResolvedValue({ Items: [] });

            const startDate = new Date('2024-01-15T00:00:00.000Z');
            const endDate = new Date('2024-01-15T23:59:59.999Z');

            const result = await adapter.getTransactionsBetweenDates(startDate, endDate);

            expect(result).toEqual([]);
        });

        it('should propagate errors from DynamoDB client', async () => {
            mockSend.mockRejectedValue(new Error('Service unavailable'));

            const startDate = new Date('2024-01-15T00:00:00.000Z');
            const endDate = new Date('2024-01-15T23:59:59.999Z');

            await expect(adapter.getTransactionsBetweenDates(startDate, endDate)).rejects.toThrow('Service unavailable');
        });
    });
});
