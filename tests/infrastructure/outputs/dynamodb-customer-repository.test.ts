import { QueryCommand, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBCustomerRepository } from '@/infrastructure/outputs/dynamodb-customer-repository';

jest.mock('@aws-sdk/client-dynamodb', () => {
    const actual = jest.requireActual('@aws-sdk/client-dynamodb');
    return {
        ...actual,
        DynamoDBClient: jest.fn().mockImplementation(() => ({
            send: jest.fn(),
        })),
    };
});

describe('DynamoDBCustomerRepository', () => {
    let repository: DynamoDBCustomerRepository;
    let mockSend: jest.Mock;
    let mockClient: { send: jest.Mock };

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.CUSTOMERS_TABLE = 'TestCustomersTable';
        process.env.ACCOUNTS_TABLE = 'TestAccountsTable';

        mockSend = jest.fn();
        mockClient = { send: mockSend };
        repository = new DynamoDBCustomerRepository(mockClient as any);
    });

    afterEach(() => {
        delete process.env.CUSTOMERS_TABLE;
        delete process.env.ACCOUNTS_TABLE;
    });

    describe('existsByIdentificationNumber', () => {
        it('should return true when a customer exists with the given normalized ID', async () => {
            mockSend.mockResolvedValue({
                Items: [{ customerId: { S: 'cust-001' } }],
            });

            const result = await repository.existsByIdentificationNumber('abc123');

            expect(result).toBe(true);
            expect(mockSend).toHaveBeenCalledTimes(1);
            const command = mockSend.mock.calls[0][0];
            expect(command).toBeInstanceOf(QueryCommand);
            expect(command.input).toEqual({
                TableName: 'TestCustomersTable',
                IndexName: 'IdentificationNumberIndex',
                KeyConditionExpression: 'normalizedIdentificationNumber = :normalizedId',
                ExpressionAttributeValues: {
                    ':normalizedId': { S: 'abc123' },
                },
                Limit: 1,
            });
        });

        it('should return false when no customer exists with the given normalized ID', async () => {
            mockSend.mockResolvedValue({
                Items: [],
            });

            const result = await repository.existsByIdentificationNumber('xyz789');

            expect(result).toBe(false);
        });

        it('should return false when Items is undefined', async () => {
            mockSend.mockResolvedValue({
                Items: undefined,
            });

            const result = await repository.existsByIdentificationNumber('xyz789');

            expect(result).toBe(false);
        });

        it('should propagate errors from DynamoDB client', async () => {
            mockSend.mockRejectedValue(new Error('Throttling'));

            await expect(repository.existsByIdentificationNumber('abc')).rejects.toThrow('Throttling');
        });
    });

    describe('getConfirmationStatus', () => {
        it('should return confirmationSentAt when customer has been confirmed', async () => {
            // First call: resolve customerId from AccountsTable
            mockSend.mockResolvedValueOnce({
                Items: [{ customerId: { S: 'cust-001' }, accountNumber: { S: '1234567890' } }],
            });
            // Second call: get customer from CustomersTable
            mockSend.mockResolvedValueOnce({
                Item: { confirmationSentAt: { S: '2024-01-15T10:00:00.000Z' } },
            });

            const result = await repository.getConfirmationStatus('1234567890');

            expect(result).toBe('2024-01-15T10:00:00.000Z');
            expect(mockSend).toHaveBeenCalledTimes(2);

            // Verify AccountsTable query
            const accountQuery = mockSend.mock.calls[0][0];
            expect(accountQuery).toBeInstanceOf(QueryCommand);
            expect(accountQuery.input).toEqual({
                TableName: 'TestAccountsTable',
                IndexName: 'AccountNumberIndex',
                KeyConditionExpression: 'accountNumber = :accountNumber',
                ExpressionAttributeValues: {
                    ':accountNumber': { S: '1234567890' },
                },
                Limit: 1,
            });

            // Verify CustomersTable get
            const customerGet = mockSend.mock.calls[1][0];
            expect(customerGet).toBeInstanceOf(GetItemCommand);
            expect(customerGet.input).toEqual({
                TableName: 'TestCustomersTable',
                Key: { customerId: { S: 'cust-001' } },
                ProjectionExpression: 'confirmationSentAt',
            });
        });

        it('should return null when no account is found for the account number', async () => {
            mockSend.mockResolvedValueOnce({
                Items: [],
            });

            const result = await repository.getConfirmationStatus('9999999999');

            expect(result).toBeNull();
            expect(mockSend).toHaveBeenCalledTimes(1);
        });

        it('should return null when customer item does not exist', async () => {
            mockSend.mockResolvedValueOnce({
                Items: [{ customerId: { S: 'cust-001' } }],
            });
            mockSend.mockResolvedValueOnce({
                Item: undefined,
            });

            const result = await repository.getConfirmationStatus('1234567890');

            expect(result).toBeNull();
        });

        it('should return null when confirmationSentAt attribute is not present', async () => {
            mockSend.mockResolvedValueOnce({
                Items: [{ customerId: { S: 'cust-001' } }],
            });
            mockSend.mockResolvedValueOnce({
                Item: {},
            });

            const result = await repository.getConfirmationStatus('1234567890');

            expect(result).toBeNull();
        });

        it('should propagate errors from DynamoDB client', async () => {
            mockSend.mockRejectedValue(new Error('Service unavailable'));

            await expect(repository.getConfirmationStatus('1234567890')).rejects.toThrow('Service unavailable');
        });
    });

    describe('markConfirmationSent', () => {
        it('should update confirmationSentAt on the customer record', async () => {
            // First call: resolve customerId
            mockSend.mockResolvedValueOnce({
                Items: [{ customerId: { S: 'cust-001' } }],
            });
            // Second call: update customer
            mockSend.mockResolvedValueOnce({});

            await repository.markConfirmationSent('1234567890', '2024-01-15T12:00:00.000Z');

            expect(mockSend).toHaveBeenCalledTimes(2);

            // Verify update command
            const updateCommand = mockSend.mock.calls[1][0];
            expect(updateCommand).toBeInstanceOf(UpdateItemCommand);
            expect(updateCommand.input).toEqual({
                TableName: 'TestCustomersTable',
                Key: { customerId: { S: 'cust-001' } },
                UpdateExpression: 'SET confirmationSentAt = :sentAt',
                ExpressionAttributeValues: {
                    ':sentAt': { S: '2024-01-15T12:00:00.000Z' },
                },
            });
        });

        it('should throw an error when no account is found for the account number', async () => {
            mockSend.mockResolvedValueOnce({
                Items: [],
            });

            await expect(
                repository.markConfirmationSent('9999999999', '2024-01-15T12:00:00.000Z')
            ).rejects.toThrow('No account found for accountNumber: 9999999999');
        });

        it('should propagate errors from DynamoDB update operation', async () => {
            mockSend.mockResolvedValueOnce({
                Items: [{ customerId: { S: 'cust-001' } }],
            });
            mockSend.mockRejectedValueOnce(new Error('ConditionalCheckFailedException'));

            await expect(
                repository.markConfirmationSent('1234567890', '2024-01-15T12:00:00.000Z')
            ).rejects.toThrow('ConditionalCheckFailedException');
        });
    });
});
