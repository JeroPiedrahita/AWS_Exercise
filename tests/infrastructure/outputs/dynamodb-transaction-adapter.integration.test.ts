import { TransactWriteItemsCommand, TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import { DynamoDBTransactionAdapter } from '@/infrastructure/outputs/dynamodb-transaction-adapter';
import { Customer } from '@/domain/entities/customer';
import { Account } from '@/domain/entities/account';
import { ConflictError } from '@/domain/exceptions/conflict.error';
import { ErrorCodes } from '@/domain/constants/error-codes';
import { AccountStatus } from '@/domain/constants/account.constants';

/**
 * Integration-level tests for DynamoDBTransactionAdapter.
 *
 * These tests verify the transactional atomicity contract, conflict detection,
 * and concurrent duplicate handling at an integration level. Since DynamoDB Local
 * is not available, we validate the contract behavior through the adapter's
 * interaction with the DynamoDB client, ensuring that:
 * - Both records are submitted in a single TransactWriteItems call (atomicity)
 * - Conditional check failures produce ConflictError with no partial data
 * - Concurrent duplicates are properly serialized (one succeeds, one fails)
 *
 * Validates: Requirements 5.3, 7.5, 7.6, 9.3
 */
describe('DynamoDBTransactionAdapter - Integration', () => {
    let adapter: DynamoDBTransactionAdapter;
    let mockSend: jest.Mock;
    let mockClient: { send: jest.Mock };

    const createCustomer = (overrides: Partial<Customer> = {}): Customer => ({
        customerId: 'cust-int-001',
        name: 'Jane Smith',
        dateOfBirth: '1985-03-20',
        identificationNumber: 'ID-456-789',
        normalizedIdentificationNumber: 'id-456-789',
        email: 'jane.smith@example.com',
        createdAt: '2024-02-01T12:00:00.000Z',
        requestId: 'req-int-001',
        createdBy: 'integration-test',
        ...overrides,
    });

    const createAccount = (overrides: Partial<Account> = {}): Account => ({
        accountId: 'acc-int-001',
        customerId: 'cust-int-001',
        accountNumber: '9876543210',
        balance: 500.00,
        status: AccountStatus.ACTIVE,
        createdAt: '2024-02-01T12:00:00.000Z',
        requestId: 'req-int-001',
        createdBy: 'integration-test',
        ...overrides,
    });

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.CUSTOMERS_TABLE = 'IntegrationCustomersTable';
        process.env.ACCOUNTS_TABLE = 'IntegrationAccountsTable';

        mockSend = jest.fn();
        mockClient = { send: mockSend };
        adapter = new DynamoDBTransactionAdapter(mockClient as any);
    });

    afterEach(() => {
        delete process.env.CUSTOMERS_TABLE;
        delete process.env.ACCOUNTS_TABLE;
    });

    /**
     * Requirement 7.5: No partial data persisted on failure.
     * Requirement 7.6: Both operations succeed or both are rolled back.
     * Requirement 9.3: Neither customer nor account persisted on partial failure.
     *
     * DynamoDB TransactWriteItems guarantees atomicity: all items in the transaction
     * either succeed together or fail together. By verifying that both Customer and
     * Account records are included in a SINGLE TransactWriteItems call, we confirm
     * the adapter leverages DynamoDB's atomic guarantee correctly.
     */
    describe('Atomic write succeeds', () => {
        it('should persist both Customer and Account records in a single atomic TransactWriteItems call', async () => {
            const customer = createCustomer();
            const account = createAccount();
            mockSend.mockResolvedValue({});

            await adapter.saveCustomerAndAccount(customer, account);

            // Verify exactly ONE TransactWriteItems call was made (atomicity contract)
            expect(mockSend).toHaveBeenCalledTimes(1);
            const command = mockSend.mock.calls[0][0];
            expect(command).toBeInstanceOf(TransactWriteItemsCommand);

            // Verify BOTH items are in the same transaction (no separate calls)
            const transactItems = command.input.TransactItems;
            expect(transactItems).toHaveLength(2);

            // Verify Customer record is present with all required fields
            const customerPut = transactItems[0].Put;
            expect(customerPut.TableName).toBe('IntegrationCustomersTable');
            expect(customerPut.Item.customerId).toEqual({ S: customer.customerId });
            expect(customerPut.Item.name).toEqual({ S: customer.name });
            expect(customerPut.Item.dateOfBirth).toEqual({ S: customer.dateOfBirth });
            expect(customerPut.Item.identificationNumber).toEqual({ S: customer.identificationNumber });
            expect(customerPut.Item.normalizedIdentificationNumber).toEqual({ S: customer.normalizedIdentificationNumber });
            expect(customerPut.Item.email).toEqual({ S: customer.email });
            expect(customerPut.Item.createdAt).toEqual({ S: customer.createdAt });
            expect(customerPut.Item.requestId).toEqual({ S: customer.requestId });
            expect(customerPut.Item.createdBy).toEqual({ S: customer.createdBy });

            // Verify Account record is present with all required fields
            const accountPut = transactItems[1].Put;
            expect(accountPut.TableName).toBe('IntegrationAccountsTable');
            expect(accountPut.Item.accountId).toEqual({ S: account.accountId });
            expect(accountPut.Item.customerId).toEqual({ S: account.customerId });
            expect(accountPut.Item.accountNumber).toEqual({ S: account.accountNumber });
            expect(accountPut.Item.balance).toEqual({ N: '500' });
            expect(accountPut.Item.status).toEqual({ S: 'ACTIVE' });
            expect(accountPut.Item.createdAt).toEqual({ S: account.createdAt });
            expect(accountPut.Item.requestId).toEqual({ S: account.requestId });
            expect(accountPut.Item.createdBy).toEqual({ S: account.createdBy });
        });

        it('should include condition expression to prevent duplicates ensuring atomicity with uniqueness', async () => {
            const customer = createCustomer();
            const account = createAccount();
            mockSend.mockResolvedValue({});

            await adapter.saveCustomerAndAccount(customer, account);

            const command = mockSend.mock.calls[0][0];
            const customerPut = command.input.TransactItems[0].Put;

            // The condition expression ensures DynamoDB rejects the entire transaction
            // if a customer with the same normalizedIdentificationNumber already exists
            expect(customerPut.ConditionExpression).toBe('attribute_not_exists(normalizedIdentificationNumber)');
        });

        it('should resolve without error when transaction succeeds confirming both records are persisted', async () => {
            const customer = createCustomer();
            const account = createAccount();
            mockSend.mockResolvedValue({});

            // If this resolves, DynamoDB guarantees both items were persisted atomically
            await expect(adapter.saveCustomerAndAccount(customer, account)).resolves.toBeUndefined();
        });
    });

    /**
     * Requirement 5.3: Only one customer record persisted for duplicate identification.
     * Requirement 7.5: No partial data persisted on repository failure.
     * Requirement 9.3: Neither customer nor account persisted on failure.
     *
     * When DynamoDB rejects the transaction due to ConditionalCheckFailed, the ENTIRE
     * transaction is rolled back. No partial data (orphaned customer or account) can exist.
     */
    describe('Atomic write fails on conditional check - no partial data', () => {
        it('should throw ConflictError with ACCOUNT_ALREADY_EXISTS code when condition check fails', async () => {
            const customer = createCustomer({ normalizedIdentificationNumber: 'duplicate-id-123' });
            const account = createAccount();

            const canceledException = new TransactionCanceledException({
                message: 'Transaction cancelled, please refer cancellation reasons for specific reasons',
                $metadata: { httpStatusCode: 400 },
                CancellationReasons: [
                    { Code: 'ConditionalCheckFailed', Message: 'The conditional request failed' },
                    { Code: 'None' },
                ],
            });
            mockSend.mockRejectedValue(canceledException);

            try {
                await adapter.saveCustomerAndAccount(customer, account);
                fail('Expected ConflictError to be thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(ConflictError);
                expect((error as ConflictError).code).toBe(ErrorCodes.ACCOUNT_ALREADY_EXISTS);
            }
        });

        it('should include the normalized identification number in error message for debugging context', async () => {
            const normalizedId = 'abc-duplicate-999';
            const customer = createCustomer({ normalizedIdentificationNumber: normalizedId });
            const account = createAccount();

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
                await adapter.saveCustomerAndAccount(customer, account);
                fail('Expected ConflictError to be thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(ConflictError);
                // Error message should contain the normalized ID for traceability
                expect((error as ConflictError).internalMessage).toContain(normalizedId);
            }
        });

        it('should guarantee no partial data exists when transaction is rejected by DynamoDB', async () => {
            const customer = createCustomer();
            const account = createAccount();

            const canceledException = new TransactionCanceledException({
                message: 'Transaction cancelled',
                $metadata: {},
                CancellationReasons: [
                    { Code: 'ConditionalCheckFailed' },
                    { Code: 'None' },
                ],
            });
            mockSend.mockRejectedValue(canceledException);

            await expect(adapter.saveCustomerAndAccount(customer, account)).rejects.toThrow(ConflictError);

            // Verify only ONE call was made (no separate retry or partial write attempt)
            // Since both items are in a single TransactWriteItems call, DynamoDB guarantees
            // that if the transaction fails, NEITHER the customer NOR the account is written.
            expect(mockSend).toHaveBeenCalledTimes(1);
            const command = mockSend.mock.calls[0][0];
            expect(command).toBeInstanceOf(TransactWriteItemsCommand);
            // Both items are in the same transaction — no separate PutItem calls that could leave partial data
            expect(command.input.TransactItems).toHaveLength(2);
        });
    });

    /**
     * Requirement 5.3: Two concurrent requests with the same identificationNumber →
     * one succeeds, the other results in ACCOUNT_ALREADY_EXISTS.
     *
     * This test simulates the concurrent duplicate scenario by having the mock client
     * resolve the first call and reject the second with ConditionalCheckFailed, mimicking
     * DynamoDB's behavior when two transactions race on the same condition expression.
     */
    describe('Concurrent duplicate handling', () => {
        it('should allow first write and reject second write with ConflictError for same normalized ID', async () => {
            const normalizedId = 'concurrent-dup-id';
            const customer1 = createCustomer({
                customerId: 'cust-concurrent-001',
                normalizedIdentificationNumber: normalizedId,
                requestId: 'req-first',
            });
            const account1 = createAccount({
                accountId: 'acc-concurrent-001',
                customerId: 'cust-concurrent-001',
                requestId: 'req-first',
            });

            const customer2 = createCustomer({
                customerId: 'cust-concurrent-002',
                normalizedIdentificationNumber: normalizedId,
                requestId: 'req-second',
            });
            const account2 = createAccount({
                accountId: 'acc-concurrent-002',
                customerId: 'cust-concurrent-002',
                requestId: 'req-second',
            });

            // Simulate DynamoDB behavior: first transaction succeeds, second fails
            // because the condition expression detects the record already exists
            const canceledException = new TransactionCanceledException({
                message: 'Transaction cancelled due to condition check failure',
                $metadata: { httpStatusCode: 400 },
                CancellationReasons: [
                    { Code: 'ConditionalCheckFailed', Message: 'The conditional request failed' },
                    { Code: 'None' },
                ],
            });

            mockSend
                .mockResolvedValueOnce({}) // First write succeeds
                .mockRejectedValueOnce(canceledException); // Second write fails (duplicate)

            // Execute both writes concurrently
            const results = await Promise.allSettled([
                adapter.saveCustomerAndAccount(customer1, account1),
                adapter.saveCustomerAndAccount(customer2, account2),
            ]);

            // Exactly one should succeed
            const succeeded = results.filter((r) => r.status === 'fulfilled');
            expect(succeeded).toHaveLength(1);

            // Exactly one should fail with ConflictError
            const failed = results.filter((r) => r.status === 'rejected');
            expect(failed).toHaveLength(1);

            const rejectedResult = failed[0] as PromiseRejectedResult;
            expect(rejectedResult.reason).toBeInstanceOf(ConflictError);
            expect((rejectedResult.reason as ConflictError).code).toBe(ErrorCodes.ACCOUNT_ALREADY_EXISTS);
        });

        it('should include the duplicated identification number in the conflict error for both concurrent requests', async () => {
            const normalizedId = 'shared-normalized-id-xyz';
            const customer1 = createCustomer({
                customerId: 'cust-dup-a',
                normalizedIdentificationNumber: normalizedId,
            });
            const account1 = createAccount({ accountId: 'acc-dup-a', customerId: 'cust-dup-a' });

            const customer2 = createCustomer({
                customerId: 'cust-dup-b',
                normalizedIdentificationNumber: normalizedId,
            });
            const account2 = createAccount({ accountId: 'acc-dup-b', customerId: 'cust-dup-b' });

            const canceledException = new TransactionCanceledException({
                message: 'Transaction cancelled',
                $metadata: {},
                CancellationReasons: [
                    { Code: 'ConditionalCheckFailed' },
                    { Code: 'None' },
                ],
            });

            mockSend
                .mockResolvedValueOnce({})
                .mockRejectedValueOnce(canceledException);

            const results = await Promise.allSettled([
                adapter.saveCustomerAndAccount(customer1, account1),
                adapter.saveCustomerAndAccount(customer2, account2),
            ]);

            const failed = results.filter((r) => r.status === 'rejected');
            const rejectedResult = failed[0] as PromiseRejectedResult;
            const conflictError = rejectedResult.reason as ConflictError;

            // The error message should contain the normalized ID for useful debugging context
            expect(conflictError.internalMessage).toContain(normalizedId);
            expect(conflictError.userMessage).toContain('identification number already exists');
        });

        it('should make exactly two TransactWriteItems calls for two concurrent requests', async () => {
            const normalizedId = 'two-calls-check';
            const customer1 = createCustomer({ normalizedIdentificationNumber: normalizedId });
            const account1 = createAccount();
            const customer2 = createCustomer({
                customerId: 'cust-second',
                normalizedIdentificationNumber: normalizedId,
            });
            const account2 = createAccount({ accountId: 'acc-second', customerId: 'cust-second' });

            const canceledException = new TransactionCanceledException({
                message: 'Transaction cancelled',
                $metadata: {},
                CancellationReasons: [
                    { Code: 'ConditionalCheckFailed' },
                    { Code: 'None' },
                ],
            });

            mockSend
                .mockResolvedValueOnce({})
                .mockRejectedValueOnce(canceledException);

            await Promise.allSettled([
                adapter.saveCustomerAndAccount(customer1, account1),
                adapter.saveCustomerAndAccount(customer2, account2),
            ]);

            // Each call should be an independent TransactWriteItems (no retries, no extra calls)
            expect(mockSend).toHaveBeenCalledTimes(2);
            expect(mockSend.mock.calls[0][0]).toBeInstanceOf(TransactWriteItemsCommand);
            expect(mockSend.mock.calls[1][0]).toBeInstanceOf(TransactWriteItemsCommand);
        });
    });
});
