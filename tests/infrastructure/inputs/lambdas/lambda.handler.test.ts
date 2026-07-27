import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '@/infrastructure/inputs/lambdas/lambda.handler';
import { BaseError } from '@/domain/exceptions/base.error';

jest.mock('@/infrastructure/outputs/dynamondb-transaction-adapter', () => ({
    DynamonDBTransactionAdapter: jest.fn().mockImplementation(() => ({
        save: jest.fn(),
        getById: jest.fn(),
        getTransactionsBetweenDates: jest.fn(),
    })),
}));

jest.mock('@/application/process-payment.use-cases', () => ({
    ProcessPaymentUseCase: jest.fn().mockImplementation(() => ({
        execute: jest.fn().mockResolvedValue(undefined),
    })),
}));

function createMockApiGatewayEvent(overrides?: Partial<APIGatewayProxyEvent>): APIGatewayProxyEvent {
    return {
        body: null,
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'POST',
        isBase64Encoded: false,
        path: '/payments',
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {
            accountId: '123456789012',
            apiId: 'api-id',
            authorizer: null,
            protocol: 'HTTP/1.1',
            httpMethod: 'POST',
            identity: {
                accessKey: null,
                accountId: null,
                apiKey: null,
                apiKeyId: null,
                caller: null,
                clientCert: null,
                cognitoAuthenticationProvider: null,
                cognitoAuthenticationType: null,
                cognitoIdentityId: null,
                cognitoIdentityPoolId: null,
                principalOrgId: null,
                sourceIp: '127.0.0.1',
                user: null,
                userAgent: 'jest-test',
                userArn: null,
            },
            path: '/payments',
            stage: 'dev',
            requestId: 'test-request-id',
            requestTimeEpoch: Date.now(),
            resourceId: 'resource-id',
            resourcePath: '/payments',
        },
        resource: '/payments',
        ...overrides,
    };
}

describe('Payment Lambda Handler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return 201 with valid JSON body containing id, accountId, and amount', async () => {
        const event = createMockApiGatewayEvent({
            body: JSON.stringify({ id: 'txn-001', accountId: 'acc-001', amount: 100 }),
        });

        const result = await handler(event);

        expect(result.statusCode).toBe(201);
        const responseBody = JSON.parse(result.body);
        expect(responseBody.message).toBe('Transaccion procesada con exito');
    });

    it('should return 400 with validation error format when event body is null', async () => {
        const event = createMockApiGatewayEvent({
            body: null,
        });

        const result = await handler(event);

        expect(result.statusCode).toBe(400);
        const responseBody = JSON.parse(result.body);
        expect(responseBody).toEqual({
            success: false,
            data: null,
            error: 'El cuerpo de la solicitud es requerido.',
        });
    });

    it('should return 400 with validation error format when event body is invalid JSON', async () => {
        const event = createMockApiGatewayEvent({
            body: 'not-valid-json{{{',
        });

        const result = await handler(event);

        expect(result.statusCode).toBe(400);
        const responseBody = JSON.parse(result.body);
        expect(responseBody).toEqual({
            success: false,
            data: null,
            error: 'El cuerpo de la solicitud no tiene un formato JSON válido.',
        });
    });

    it('should return 400 with validation error format when required fields are missing', async () => {
        const event = createMockApiGatewayEvent({
            body: JSON.stringify({ id: 'txn-001' }),
        });

        const result = await handler(event);

        expect(result.statusCode).toBe(400);
        const responseBody = JSON.parse(result.body);
        expect(responseBody.success).toBe(false);
        expect(responseBody.data).toBeNull();
        expect(responseBody.error).toBeDefined();
        expect(responseBody.error).toContain('accountId');
    });

    it('should return 400 with validation error format when amount is invalid type', async () => {
        const event = createMockApiGatewayEvent({
            body: JSON.stringify({ id: 'txn-001', accountId: 'acc-001', amount: 'not-a-number' }),
        });

        const result = await handler(event);

        expect(result.statusCode).toBe(400);
        const responseBody = JSON.parse(result.body);
        expect(responseBody.success).toBe(false);
        expect(responseBody.data).toBeNull();
        expect(responseBody.error).toBeDefined();
        expect(responseBody.error).toContain('amount');
    });

    it('should return 400 with validation error format when extra fields are present (strict mode)', async () => {
        const event = createMockApiGatewayEvent({
            body: JSON.stringify({ id: 'txn-001', accountId: 'acc-001', amount: 100, extraField: 'not-allowed' }),
        });

        const result = await handler(event);

        expect(result.statusCode).toBe(400);
        const responseBody = JSON.parse(result.body);
        expect(responseBody.success).toBe(false);
        expect(responseBody.data).toBeNull();
        expect(responseBody.error).toBeDefined();
    });

    it('should return 400 with domain error format when a BaseError is thrown', async () => {
        const { ProcessPaymentUseCase } = require('@/application/process-payment.use-cases');

        class TestBaseError extends BaseError {
            constructor() {
                super('Internal technical message', 'Error de dominio para el usuario');
            }
        }

        ProcessPaymentUseCase.mockImplementation(() => ({
            execute: jest.fn().mockRejectedValue(new TestBaseError()),
        }));

        const event = createMockApiGatewayEvent({
            body: JSON.stringify({ id: 'txn-001', accountId: 'acc-001', amount: 100 }),
        });

        const result = await handler(event);

        expect(result.statusCode).toBe(400);
        const responseBody = JSON.parse(result.body);
        expect(responseBody).toEqual({
            error: 'Error de dominio para el usuario',
        });
    });

    it('should return 500 when an unhandled error (not BaseError) is thrown', async () => {
        const { ProcessPaymentUseCase } = require('@/application/process-payment.use-cases');
        ProcessPaymentUseCase.mockImplementation(() => ({
            execute: jest.fn().mockRejectedValue(new Error('Unexpected database failure')),
        }));

        const event = createMockApiGatewayEvent({
            body: JSON.stringify({ id: 'txn-001', accountId: 'acc-001', amount: 100 }),
        });

        const result = await handler(event);

        expect(result.statusCode).toBe(500);
        const responseBody = JSON.parse(result.body);
        expect(responseBody).toEqual({
            error: 'Error interno del servidor',
        });
    });
});
