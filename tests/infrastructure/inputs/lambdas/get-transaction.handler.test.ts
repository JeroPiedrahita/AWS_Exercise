import { APIGatewayProxyEvent } from 'aws-lambda';
import { TransactionNotFoundError } from '@/domain/exceptions/transaction-not-found.error';
import { createValidTransaction } from '../../../fixtures/transaction.fixtures';

jest.mock('@/infrastructure/outputs/dynamondb-transaction-adapter');
jest.mock('@/application/get-transaction.use-case');

import { handler } from '@/infrastructure/inputs/lambdas/get-transaction.handler';
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

    it('should return 200 with serialized Transaction when pathParameters contains a valid id', async () => {
        const transaction = createValidTransaction({ id: 'txn-123' });
        mockExecute.mockResolvedValue(transaction);

        const event = createApiGatewayEvent({
            pathParameters: { id: 'txn-123' },
        });

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual(JSON.parse(JSON.stringify(transaction)));
        expect(mockExecute).toHaveBeenCalledWith({ id: 'txn-123' });
    });

    it('should return 400 when pathParameters is null', async () => {
        const event = createApiGatewayEvent({
            pathParameters: null,
        });

        const result = await handler(event);

        expect(result.statusCode).toBe(400);
        const body = JSON.parse(result.body);
        expect(body).toHaveProperty('error');
        expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should return 400 when pathParameters does not contain an id', async () => {
        const event = createApiGatewayEvent({
            pathParameters: { otherparam: 'value' },
        });

        const result = await handler(event);

        expect(result.statusCode).toBe(400);
        const body = JSON.parse(result.body);
        expect(body).toHaveProperty('error');
        expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should return 404 when the transaction is not found (TransactionNotFoundError)', async () => {
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
        expect(body).toHaveProperty('error');
        expect(body.error).toBe('Verifica el id de la transacción');
    });

    it('should return 500 when an unhandled error is thrown', async () => {
        mockExecute.mockRejectedValue(new Error('Unexpected database failure'));

        const event = createApiGatewayEvent({
            pathParameters: { id: 'txn-456' },
        });

        const result = await handler(event);

        expect(result.statusCode).toBe(500);
        const body = JSON.parse(result.body);
        expect(body).toHaveProperty('error');
        expect(body.error).toBe('Error interno del servidor');
    });
});
