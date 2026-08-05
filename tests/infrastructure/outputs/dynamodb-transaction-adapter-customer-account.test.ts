import { TransactWriteItemsCommand, TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import { DynamoDBTransactionAdapter } from '@/infrastructure/outputs/dynamodb-transaction-adapter';
import { Customer } from '@/domain/entities/customer';
import { Account } from '@/domain/entities/account';
import { ConflictError } from '@/domain/exceptions/conflict.error';
import { ErrorCodes } from '@/domain/constants/error-codes';
import { AccountStatus } from '@/domain/constants/account.constants';

describe('DynamoDBTransactionAdapter', () => {
    let adapter: DynamoDBTransactionAdapter;
    let mockSend: jest.Mock;
    let mockClient: { send: jest.Mock };

    const testCustomer: Customer = {
        customerId: 'cust-001',
        name: 'John Doe',
        dateOfBirth: '1990-05-15',
        identificationNumber: 'ABC-123',
        normalizedIdentificationNumber: 'abc-123',
        email: 'john@example.com',
        createdAt: '2024-01-15T10:00:00.000Z',
        requestId: 'req-001',
        createdBy: 'system',
    };

    const testAccount: Account = {
        accountId: 'acc-001',
        customerId: 'cust-001',
        accountNumber: '1234567890',
        balance: 1000.50,
        status: AccountStatus.ACTIVE,
        createdAt: '2024-01-15T10:00:00.000Z',
        requestId: 'req-001',
        createdBy: 'system',
    };

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.CUSTOMERS_TABLE = 'TestCustomersTable';
        process.env.ACCOUNTS_TABLE = 'TestAccountsTable';

        mockSend = jest.fn();
        mockClient = { send: mockSend };
        adapter = new DynamoDBTransactionAdapter(mockClient as any);
    });

    afterEach(() => {
        delete process.env.CUSTOMERS_TABLE;
        delete process.env.ACCOUNTS_TABLE;
    });

    describe('saveCustomerAndAccount', () => {
        it('should send a TransactWriteItemsCommand with customer and account items', async () => {
            mockSend.mockResolvedValue({});

            await adapter.saveCustomerAndAccount(testCustomer, testAccount);

            expect(mockSend).toHaveBeenCalledTimes(1);
            const command = mockSend.mock.calls[0][0];
            expect(command).toBeInstanceOf(TransactWriteItemsCommand);
            expect(command.input.TransactItems).toHaveLength(2);
        });

        it('should map all customer fields to DynamoDB attribute types', async () => {
            mockSend.mockResolvedValue({});

            await adapter.saveCustomerAndAccount(testCustomer, testAccount);

            const command = mockSend.mock.calls[0][0];
            const customerPut = command.input.TransactItems[0].Put;

            expect(customerPut.TableName).toBe('TestCustomersTable');
            expect(customerPut.Item).toEqual({
                customerId: { S: 'cust-001' },
                name: { S: 'John Doe' },
                dateOfBirth: { S: '1990-05-15' },
                identificationNumber: { S: 'ABC-123' },
                normalizedIdentificationNumber: { S: 'abc-123' },
                email: { S: 'john@example.com' },
                createdAt: { S: '2024-01-15T10:00:00.000Z' },
                requestId: { S: 'req-001' },
                createdBy: { S: 'system' },
            });
        });

        it('should include confirmationSentAt when present on customer', async () => {
            mockSend.mockResolvedValue({});
            const customerWithConfirmation: Customer = {
                ...testCustomer,
                confirmationSentAt: '2024-01-15T11:00:00.000Z',
            };

            await adapter.saveCustomerAndAccount(customerWithConfirmation, testAccount);

            const command = mockSend.mock.calls[0][0];
            const customerPut = command.input.TransactItems[0].Put;

            expect(customerPut.Item['confirmationSentAt']).toEqual({ S: '2024-01-15T11:00:00.000Z' });
        });

        it('should not include confirmationSentAt when undefined on customer', async () => {
            mockSend.mockResolvedValue({});

            await adapter.saveCustomerAndAccount(testCustomer, testAccount);

            const command = mockSend.mock.calls[0][0];
            const customerPut = command.input.TransactItems[0].Put;

            expect(customerPut.Item['confirmationSentAt']).toBeUndefined();
        });

        it('should include ConditionExpression on customer put to prevent duplicates', async () => {
            mockSend.mockResolvedValue({});

            await adapter.saveCustomerAndAccount(testCustomer, testAccount);

            const command = mockSend.mock.calls[0][0];
            const customerPut = command.input.TransactItems[0].Put;

            expect(customerPut.ConditionExpression).toBe('attribute_not_exists(normalizedIdentificationNumber)');
        });

        it('should map all account fields to DynamoDB attribute types with balance as Number', async () => {
            mockSend.mockResolvedValue({});

            await adapter.saveCustomerAndAccount(testCustomer, testAccount);

            const command = mockSend.mock.calls[0][0];
            const accountPut = command.input.TransactItems[1].Put;

            expect(accountPut.TableName).toBe('TestAccountsTable');
            expect(accountPut.Item).toEqual({
                accountId: { S: 'acc-001' },
                customerId: { S: 'cust-001' },
                accountNumber: { S: '1234567890' },
                balance: { N: '1000.5' },
                status: { S: 'ACTIVE' },
                createdAt: { S: '2024-01-15T10:00:00.000Z' },
                requestId: { S: 'req-001' },
                createdBy: { S: 'system' },
            });
        });

        it('should throw ConflictError when TransactionCanceledException has ConditionalCheckFailed', async () => {
            const canceledException = new TransactionCanceledException({
                message: 'Transaction cancelled',
                $metadata: {},
                CancellationReasons: [
                    { Code: 'ConditionalCheckFailed' },
                    { Code: 'None' },
                ],
            });
            mockSend.mockRejectedValue(canceledException);

            await expect(adapter.saveCustomerAndAccount(testCustomer, testAccount)).rejects.toThrow(ConflictError);
        });

        it('should throw ConflictError with ACCOUNT_ALREADY_EXISTS code on condition check failure', async () => {
            const canceledException = new TransactionCanceledException({
                message: 'Transaction cancelled',
                $metadata: {},
                CancellationReasons: [
                    { Code: 'ConditionalCheckFailed' },
                    { Code: 'None' },
                ],
            });
            mockSend.mockRejectedValue(canceledException);

            try {
                await adapter.saveCustomerAndAccount(testCustomer, testAccount);
                fail('Expected ConflictError to be thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(ConflictError);
                expect((error as ConflictError).code).toBe(ErrorCodes.ACCOUNT_ALREADY_EXISTS);
            }
        });

        it('should re-throw TransactionCanceledException when no ConditionalCheckFailed reason', async () => {
            const canceledException = new TransactionCanceledException({
                message: 'Transaction cancelled for other reason',
                $metadata: {},
                CancellationReasons: [
                    { Code: 'None' },
                    { Code: 'None' },
                ],
            });
            mockSend.mockRejectedValue(canceledException);

            await expect(adapter.saveCustomerAndAccount(testCustomer, testAccount)).rejects.toThrow(TransactionCanceledException);
        });

        it('should re-throw non-TransactionCanceledException errors', async () => {
            const genericError = new Error('Network failure');
            mockSend.mockRejectedValue(genericError);

            await expect(adapter.saveCustomerAndAccount(testCustomer, testAccount)).rejects.toThrow('Network failure');
        });

        it('should use default table names when environment variables are not set', async () => {
            delete process.env.CUSTOMERS_TABLE;
            delete process.env.ACCOUNTS_TABLE;

            const adapterWithDefaults = new DynamoDBTransactionAdapter(mockClient as any);
            mockSend.mockResolvedValue({});

            await adapterWithDefaults.saveCustomerAndAccount(testCustomer, testAccount);

            const command = mockSend.mock.calls[0][0];
            expect(command.input.TransactItems[0].Put.TableName).toBe('CustomersTable');
            expect(command.input.TransactItems[1].Put.TableName).toBe('AccountsTable');
        });
    });
});
