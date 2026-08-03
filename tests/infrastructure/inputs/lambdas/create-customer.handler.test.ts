import { APIGatewayProxyEvent } from 'aws-lambda';
import fc from 'fast-check';
import { ValidationError } from '@/domain/exceptions/validation.error';
import { ConflictError } from '@/domain/exceptions/conflict.error';
import { ErrorCodes } from '@/domain/constants/error-codes';

jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/client-sqs');
jest.mock('@/application/create-customer-account.use-case');
jest.mock('@/infrastructure/outputs/dynamodb-customer-repository');
jest.mock('@/infrastructure/outputs/dynamodb-account-repository');
jest.mock('@/infrastructure/outputs/dynamodb-transaction-adapter');
jest.mock('@/infrastructure/outputs/account-number-generator-adapter');
jest.mock('@/infrastructure/outputs/sqs-confirmation-queue-adapter');

import { handler } from '@/infrastructure/inputs/lambdas/create-customer-handler';
import { CreateCustomerAccountUseCase } from '@/application/create-customer-account.use-case';

const MockCreateCustomerAccountUseCase = CreateCustomerAccountUseCase as jest.MockedClass<typeof CreateCustomerAccountUseCase>;

function createApiGatewayEvent(overrides?: Partial<APIGatewayProxyEvent>): APIGatewayProxyEvent {
    return {
        body: null,
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'POST',
        isBase64Encoded: false,
        path: '/customers',
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {
            requestId: 'test-request-id-123',
        } as unknown as APIGatewayProxyEvent['requestContext'],
        resource: '',
        ...overrides,
    };
}

function createValidBody() {
    return {
        name: 'John Doe',
        dateOfBirth: '1990-01-15',
        identificationNumber: 'ABC123456',
        email: 'john@example.com',
        initialAmount: 1000,
    };
}

describe('create-customer.handler', () => {
    let mockExecute: jest.Mock;
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        mockExecute = jest.fn();
        MockCreateCustomerAccountUseCase.mockImplementation(() => ({
            execute: mockExecute,
        } as unknown as CreateCustomerAccountUseCase));
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    describe('Success path', () => {
        it('should return 201 with standard envelope on successful creation', async () => {
            const useCaseResult = {
                accountNumber: '1234567890',
                status: 'ACTIVE',
                balance: 1000,
            };
            mockExecute.mockResolvedValue(useCaseResult);

            const event = createApiGatewayEvent({
                body: JSON.stringify(createValidBody()),
            });

            const result = await handler(event);

            expect(result.statusCode).toBe(201);
            const body = JSON.parse(result.body);
            expect(body).toEqual({
                success: true,
                data: useCaseResult,
                error: null,
            });
        });

        it('should pass validated fields and requestId to the use case', async () => {
            mockExecute.mockResolvedValue({
                accountNumber: '0000000001',
                status: 'ACTIVE',
                balance: 500,
            });

            const requestBody = createValidBody();
            const event = createApiGatewayEvent({
                body: JSON.stringify(requestBody),
                requestContext: {
                    requestId: 'my-req-id',
                } as unknown as APIGatewayProxyEvent['requestContext'],
            });

            await handler(event);

            expect(mockExecute).toHaveBeenCalledWith({
                name: requestBody.name,
                dateOfBirth: requestBody.dateOfBirth,
                identificationNumber: requestBody.identificationNumber,
                email: requestBody.email,
                initialAmount: requestBody.initialAmount,
                requestId: 'my-req-id',
            });
        });
    });

    describe('Invalid body handling', () => {
        it('should return 400 with INVALID_REQUEST_FORMAT when body is null', async () => {
            const event = createApiGatewayEvent({ body: null });

            const result = await handler(event);

            expect(result.statusCode).toBe(400);
            const body = JSON.parse(result.body);
            expect(body).toEqual({
                success: false,
                data: null,
                error: { code: ErrorCodes.INVALID_REQUEST_FORMAT },
            });
        });

        it('should return 400 with INVALID_REQUEST_FORMAT when body is not valid JSON', async () => {
            const event = createApiGatewayEvent({ body: 'not-json{{{' });

            const result = await handler(event);

            expect(result.statusCode).toBe(400);
            const body = JSON.parse(result.body);
            expect(body).toEqual({
                success: false,
                data: null,
                error: { code: ErrorCodes.INVALID_REQUEST_FORMAT },
            });
        });
    });

    describe('Schema validation failure', () => {
        it('should return 400 with INVALID_REQUEST_FORMAT when required fields are missing', async () => {
            const event = createApiGatewayEvent({
                body: JSON.stringify({ name: 'Only Name' }),
            });

            const result = await handler(event);

            expect(result.statusCode).toBe(400);
            const body = JSON.parse(result.body);
            expect(body.success).toBe(false);
            expect(body.data).toBeNull();
            expect(body.error.code).toBe(ErrorCodes.INVALID_REQUEST_FORMAT);
        });

        it('should return 400 with INVALID_REQUEST_FORMAT when unknown fields are present', async () => {
            const event = createApiGatewayEvent({
                body: JSON.stringify({
                    ...createValidBody(),
                    unknownField: 'unexpected',
                }),
            });

            const result = await handler(event);

            expect(result.statusCode).toBe(400);
            const body = JSON.parse(result.body);
            expect(body.success).toBe(false);
            expect(body.data).toBeNull();
            expect(body.error.code).toBe(ErrorCodes.INVALID_REQUEST_FORMAT);
        });
    });

    describe('Error mapping', () => {
        it('should return 400 when use case throws ValidationError', async () => {
            mockExecute.mockRejectedValue(
                new ValidationError(
                    ErrorCodes.INVALID_AGE,
                    undefined,
                    'Customer must be at least 18 years old',
                    'Age requirement not met'
                )
            );

            const event = createApiGatewayEvent({
                body: JSON.stringify(createValidBody()),
            });

            const result = await handler(event);

            expect(result.statusCode).toBe(400);
            const body = JSON.parse(result.body);
            expect(body).toEqual({
                success: false,
                data: null,
                error: { code: ErrorCodes.INVALID_AGE },
            });
        });

        it('should return 400 with fields when ValidationError includes fields', async () => {
            mockExecute.mockRejectedValue(
                new ValidationError(
                    ErrorCodes.MISSING_REQUIRED_FIELD,
                    ['name', 'email'],
                    'Missing required fields: name, email',
                    'Required fields are missing'
                )
            );

            const event = createApiGatewayEvent({
                body: JSON.stringify(createValidBody()),
            });

            const result = await handler(event);

            expect(result.statusCode).toBe(400);
            const body = JSON.parse(result.body);
            expect(body).toEqual({
                success: false,
                data: null,
                error: { code: ErrorCodes.MISSING_REQUIRED_FIELD, fields: ['name', 'email'] },
            });
        });

        it('should return 409 when use case throws ConflictError', async () => {
            mockExecute.mockRejectedValue(
                new ConflictError(
                    ErrorCodes.ACCOUNT_ALREADY_EXISTS,
                    'Customer with ID "abc123" already exists',
                    'Account already exists'
                )
            );

            const event = createApiGatewayEvent({
                body: JSON.stringify(createValidBody()),
            });

            const result = await handler(event);

            expect(result.statusCode).toBe(409);
            const body = JSON.parse(result.body);
            expect(body).toEqual({
                success: false,
                data: null,
                error: { code: ErrorCodes.ACCOUNT_ALREADY_EXISTS },
            });
        });

        it('should return 500 with INTERNAL_SERVER_ERROR when use case throws unknown error', async () => {
            mockExecute.mockRejectedValue(new Error('Database connection timeout'));

            const event = createApiGatewayEvent({
                body: JSON.stringify(createValidBody()),
            });

            const result = await handler(event);

            expect(result.statusCode).toBe(500);
            const body = JSON.parse(result.body);
            expect(body).toEqual({
                success: false,
                data: null,
                error: { code: ErrorCodes.INTERNAL_SERVER_ERROR },
            });
        });
    });

    describe('Structured error logging', () => {
        it('should log structured JSON with requestId, message, stack, and elapsedMs for unknown errors', async () => {
            const fakeNow = 1700000000000;
            jest.spyOn(Date, 'now')
                .mockReturnValueOnce(fakeNow)       // startTime
                .mockReturnValueOnce(fakeNow + 150); // elapsed calculation

            const thrownError = new Error('Unexpected DB failure');
            mockExecute.mockRejectedValue(thrownError);

            const event = createApiGatewayEvent({
                body: JSON.stringify(createValidBody()),
                requestContext: {
                    requestId: 'req-abc-456',
                } as unknown as APIGatewayProxyEvent['requestContext'],
            });

            await handler(event);

            expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
            const loggedJson = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
            expect(loggedJson.level).toBe('error');
            expect(loggedJson.requestId).toBe('req-abc-456');
            expect(loggedJson.message).toBe('Unexpected DB failure');
            expect(loggedJson.stack).toBeDefined();
            expect(loggedJson.stack).toContain('Unexpected DB failure');
            expect(loggedJson.elapsedMs).toBe(150);

            jest.spyOn(Date, 'now').mockRestore();
        });

        it('should log structured JSON with requestId, message, code, and elapsedMs for ValidationError', async () => {
            const fakeNow = 1700000000000;
            jest.spyOn(Date, 'now')
                .mockReturnValueOnce(fakeNow)
                .mockReturnValueOnce(fakeNow + 75);

            mockExecute.mockRejectedValue(
                new ValidationError(
                    ErrorCodes.INVALID_EMAIL_FORMAT,
                    undefined,
                    'Email format is invalid: missing @ symbol',
                    'Invalid email'
                )
            );

            const event = createApiGatewayEvent({
                body: JSON.stringify(createValidBody()),
                requestContext: {
                    requestId: 'req-validation-789',
                } as unknown as APIGatewayProxyEvent['requestContext'],
            });

            await handler(event);

            expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
            const loggedJson = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
            expect(loggedJson.level).toBe('error');
            expect(loggedJson.requestId).toBe('req-validation-789');
            expect(loggedJson.message).toBe('Email format is invalid: missing @ symbol');
            expect(loggedJson.code).toBe(ErrorCodes.INVALID_EMAIL_FORMAT);
            expect(loggedJson.stack).toBeDefined();
            expect(loggedJson.elapsedMs).toBe(75);

            jest.spyOn(Date, 'now').mockRestore();
        });

        it('should log structured JSON with requestId, message, code, and elapsedMs for ConflictError', async () => {
            const fakeNow = 1700000000000;
            jest.spyOn(Date, 'now')
                .mockReturnValueOnce(fakeNow)
                .mockReturnValueOnce(fakeNow + 200);

            mockExecute.mockRejectedValue(
                new ConflictError(
                    ErrorCodes.ACCOUNT_ALREADY_EXISTS,
                    'Duplicate identification number detected: abc123',
                    'Account already exists'
                )
            );

            const event = createApiGatewayEvent({
                body: JSON.stringify(createValidBody()),
                requestContext: {
                    requestId: 'req-conflict-101',
                } as unknown as APIGatewayProxyEvent['requestContext'],
            });

            await handler(event);

            expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
            const loggedJson = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
            expect(loggedJson.level).toBe('error');
            expect(loggedJson.requestId).toBe('req-conflict-101');
            expect(loggedJson.message).toBe('Duplicate identification number detected: abc123');
            expect(loggedJson.code).toBe(ErrorCodes.ACCOUNT_ALREADY_EXISTS);
            expect(loggedJson.stack).toBeDefined();
            expect(loggedJson.elapsedMs).toBe(200);

            jest.spyOn(Date, 'now').mockRestore();
        });

        it('should handle non-Error objects thrown as unknown errors', async () => {
            mockExecute.mockRejectedValue('string error thrown');

            const event = createApiGatewayEvent({
                body: JSON.stringify(createValidBody()),
            });

            const result = await handler(event);

            expect(result.statusCode).toBe(500);
            const loggedJson = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
            expect(loggedJson.message).toBe('string error thrown');
            expect(loggedJson.stack).toBeUndefined();
        });
    });

    describe('Error response sanitization', () => {
        it('should never expose internal error message in 500 response body', async () => {
            const secretMessage = 'Connection to rds-prod-db.internal:5432 failed with credentials user=admin';
            mockExecute.mockRejectedValue(new Error(secretMessage));

            const event = createApiGatewayEvent({
                body: JSON.stringify(createValidBody()),
            });

            const result = await handler(event);

            expect(result.statusCode).toBe(500);
            expect(result.body).not.toContain(secretMessage);
            expect(result.body).not.toContain('rds-prod-db');
            expect(result.body).not.toContain('credentials');
            const body = JSON.parse(result.body);
            expect(body.error.code).toBe(ErrorCodes.INTERNAL_SERVER_ERROR);
        });

        it('should never expose stack trace in 500 response body', async () => {
            const error = new Error('Internal failure');
            mockExecute.mockRejectedValue(error);

            const event = createApiGatewayEvent({
                body: JSON.stringify(createValidBody()),
            });

            const result = await handler(event);

            expect(result.statusCode).toBe(500);
            expect(result.body).not.toContain('at ');
            expect(result.body).not.toContain('.ts:');
            expect(result.body).not.toContain('Internal failure');
        });

        /**
         * Property 10: Error response sanitization
         * For ANY random error message string, the 500 response body should never contain that string.
         * **Validates: Requirements 9.1, 9.2**
         */
        it('Property 10: for any random error message, the 500 response should never contain that message', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.string({ minLength: 1, maxLength: 200 }),
                    async (randomErrorMessage) => {
                        mockExecute.mockRejectedValue(new Error(randomErrorMessage));

                        const event = createApiGatewayEvent({
                            body: JSON.stringify(createValidBody()),
                        });

                        const result = await handler(event);

                        expect(result.statusCode).toBe(500);
                        const body = JSON.parse(result.body);

                        // The response body should NEVER contain the internal error message
                        expect(body.success).toBe(false);
                        expect(body.data).toBeNull();
                        expect(body.error.code).toBe(ErrorCodes.INTERNAL_SERVER_ERROR);

                        // Ensure the raw error message is not leaked in the response body
                        // Only check non-trivial messages (skip strings that are substrings of expected response structure)
                        const expectedResponse = '{"success":false,"data":null,"error":{"code":"INTERNAL_SERVER_ERROR"}}';
                        const isSubstringOfResponse = expectedResponse.includes(randomErrorMessage);

                        if (!isSubstringOfResponse && randomErrorMessage.trim().length > 0) {
                            expect(result.body).not.toContain(randomErrorMessage);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    describe('requestId extraction', () => {
        it('should use "unknown" as requestId when requestContext is missing', async () => {
            mockExecute.mockRejectedValue(new Error('Some error'));

            const event = createApiGatewayEvent({
                body: JSON.stringify(createValidBody()),
                requestContext: {} as unknown as APIGatewayProxyEvent['requestContext'],
            });

            await handler(event);

            const loggedJson = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
            expect(loggedJson.requestId).toBe('unknown');
        });
    });
});
