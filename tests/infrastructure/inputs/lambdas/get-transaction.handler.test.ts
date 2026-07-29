import { APIGatewayProxyEvent } from 'aws-lambda';
import { TransactionNotFoundError } from '@/domain/exceptions/transaction-not-found.error';
import { BaseError } from '@/domain/exceptions/base.error';
import { createValidTransaction } from '../../../fixtures/transaction.fixtures';
import { SchemaLimits } from '@/infrastructure/constants/schema.constants';

jest.mock('@/infrastructure/outputs/dynamondb-transaction-adapter');
jest.mock('@/application/get-transaction.use-case');

import { handler } from '@/infrastructure/inputs/lambdas/get-transaction-handler';
import { GetTransactionUseCase } from '@/application/get-transaction.use-case';

const MockGetTransactionUseCase = GetTransactionUseCase as jest.MockedClass<typeof GetTransactionUseCase>;

function createApiGatewayEvent(overrides?: Partial<APIGatewayProxyEvent>): APIGatewayProxyEvent {
    return {
        body: null,
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'GET',
        isBase64Encoded: false,
        path: '/transaction',
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as APIGatewayProxyEvent['requestContext'],
        resource: '',
        ...overrides,
    };
}

describe('get-transaction.handler', () => {
    let mockExecute: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        mockExecute = jest.fn();
        MockGetTransactionUseCase.mockImplementation(() => ({
            execute: mockExecute,
        } as unknown as GetTransactionUseCase));
    });

    it('should return 200 with serialized Transaction including createdAt as ISO string when pathParameters contains a valid id', async () => {
        const transaction = createValidTransaction({ id: 'txn-123' });
        mockExecute.mockResolvedValue(transaction);

        const event = createApiGatewayEvent({
            pathParameters: { id: 'txn-123' },
        });

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        const body = JSON.parse(result.body);
        expect(body.id).toBe('txn-123');
        expect(body.accountId).toBe('acc-001');
        expect(body.amount).toBe(100);
        expect(body.status).toBe('COMPLETED');
        expect(body.createdAt).toBe('2024-01-15T10:00:00.000Z');
        expect(mockExecute).toHaveBeenCalledWith({ id: 'txn-123' });
    });

    it('should return 400 with validation error format when pathParameters is null', async () => {
        const event = createApiGatewayEvent({
            pathParameters: null,
        });

        const result = await handler(event);

        expect(result.statusCode).toBe(400);
        const body = JSON.parse(result.body);
        expect(body).toEqual({
            success: false,
            data: null,
            error: 'Los parámetros de ruta son requeridos.',
        });
        expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should return 400 with validation error format when id is empty', async () => {
        const event = createApiGatewayEvent({
            pathParameters: { id: '' },
        });

        const result = await handler(event);

        expect(result.statusCode).toBe(400);
        const body = JSON.parse(result.body);
        expect(body.success).toBe(false);
        expect(body.data).toBeNull();
        expect(body.error).toBeDefined();
        expect(body.error).toContain('id');
        expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should return 400 with validation error format when id exceeds max length', async () => {
        const event = createApiGatewayEvent({
            pathParameters: { id: 'a'.repeat(SchemaLimits.MAX_TRANSACTION_ID_LENGTH + 1) },
        });

        const result = await handler(event);

        expect(result.statusCode).toBe(400);
        const body = JSON.parse(result.body);
        expect(body.success).toBe(false);
        expect(body.data).toBeNull();
        expect(body.error).toBeDefined();
        expect(body.error).toContain('id');
        expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should return 400 with validation error format when pathParameters does not contain an id', async () => {
        const event = createApiGatewayEvent({
            pathParameters: { otherparam: 'value' },
        });

        const result = await handler(event);

        expect(result.statusCode).toBe(400);
        const body = JSON.parse(result.body);
        expect(body.success).toBe(false);
        expect(body.data).toBeNull();
        expect(body.error).toBeDefined();
        expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should return 404 with domain error format when the transaction is not found (TransactionNotFoundError)', async () => {
        mockExecute.mockRejectedValue(
            new TransactionNotFoundError(
                'Transaction not found',
                'Verifica el id de la transacción'
            )
        );

        const event = createApiGatewayEvent({
            pathParameters: { id: 'non-existent-id' },
        });

        const result = await handler(event);

        expect(result.statusCode).toBe(404);
        const body = JSON.parse(result.body);
        expect(body).toEqual({
            error: 'Verifica el id de la transacción',
        });
    });

    it('should return 400 with domain error format when a BaseError is thrown', async () => {
        class TestBaseError extends BaseError {
            constructor() {
                super('Internal error', 'Error de dominio');
            }
        }

        mockExecute.mockRejectedValue(new TestBaseError());

        const event = createApiGatewayEvent({
            pathParameters: { id: 'txn-456' },
        });

        const result = await handler(event);

        expect(result.statusCode).toBe(400);
        const body = JSON.parse(result.body);
        expect(body).toEqual({
            error: 'Error de dominio',
        });
    });

    it('should return 500 when an unhandled error is thrown', async () => {
        mockExecute.mockRejectedValue(new Error('Unexpected database failure'));

        const event = createApiGatewayEvent({
            pathParameters: { id: 'txn-456' },
        });

        const result = await handler(event);

        expect(result.statusCode).toBe(500);
        const body = JSON.parse(result.body);
        expect(body).toEqual({
            error: 'Error interno del servidor',
        });
    });

    it('should return 500 when response contract validation fails', async () => {
        const invalidTransaction = {
            id: 'txn-789',
            accountId: 'acc-001',
            amount: 100,
            status: 'COMPLETED',
            createdAt: new Date('invalid-date'),
        };
        mockExecute.mockResolvedValue(invalidTransaction);

        const event = createApiGatewayEvent({
            pathParameters: { id: 'txn-789' },
        });

        const result = await handler(event);

        expect(result.statusCode).toBe(500);
        const body = JSON.parse(result.body);
        expect(body).toEqual({
            error: 'Error interno del servidor',
        });
    });
});
