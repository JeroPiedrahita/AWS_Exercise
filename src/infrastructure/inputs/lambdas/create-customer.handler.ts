import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { SQSClient } from '@aws-sdk/client-sqs';
import { CreateCustomerAccountUseCase } from '../../../application/create-customer-account.use-case';
import { DynamoDBCustomerRepository } from '../../outputs/dynamodb-customer-repository';
import { DynamoDBAccountRepository } from '../../outputs/dynamodb-account-repository';
import { DynamoDBTransactionAdapter } from '../../outputs/dynamodb-transaction-adapter';
import { AccountNumberGeneratorAdapter } from '../../outputs/account-number-generator-adapter';
import { SqsConfirmationQueueAdapter } from '../../outputs/sqs-confirmation-queue-adapter';
import { CreateCustomerRequestSchema } from '../schemas/create-customer-schemas';
import { validateSchema } from '../schemas/validation.helper';
import { ValidationError } from '../../../domain/exceptions/validation.error';
import { ConflictError } from '../../../domain/exceptions/conflict.error';
import { ErrorCodes } from '../../../domain/constants/error-codes';

/**
 * Lambda handler for the POST /customers endpoint.
 * Creates a new customer account. Does not require authentication.
 * @param event - The API Gateway proxy event containing the request.
 * @returns The API Gateway proxy result with the standard envelope response.
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const startTime = Date.now();
    const requestId = event.requestContext?.requestId ?? 'unknown';

    try {
        if (!event.body) {
            return buildErrorResponse(400, ErrorCodes.INVALID_REQUEST_FORMAT, 'The request body is required.');
        }

        let rawBody: unknown;
        try {
            rawBody = JSON.parse(event.body);
        } catch {
            return buildErrorResponse(400, ErrorCodes.INVALID_REQUEST_FORMAT, 'The request body is not valid JSON.');
        }

        const validation = validateSchema(CreateCustomerRequestSchema, rawBody);
        if (!validation.success) {
            return buildErrorResponse(400, ErrorCodes.INVALID_REQUEST_FORMAT, 'The request body does not match the expected format.', [validation.error]);
        }

        const { name, dateOfBirth, identificationNumber, email, initialAmount } = validation.data;

        // Composition root: instantiate adapters and use case
        const dynamoDBClient = new DynamoDBClient({});
        const sqsClient = new SQSClient({});

        const customerRepository = new DynamoDBCustomerRepository(dynamoDBClient);
        const accountRepository = new DynamoDBAccountRepository(dynamoDBClient);
        const customerAccountRepository = new DynamoDBTransactionAdapter(dynamoDBClient);
        const accountNumberGenerator = new AccountNumberGeneratorAdapter(accountRepository);
        const confirmationQueue = new SqsConfirmationQueueAdapter(sqsClient);

        const useCase = new CreateCustomerAccountUseCase(
            customerRepository,
            customerAccountRepository,
            accountNumberGenerator,
            confirmationQueue
        );

        const result = await useCase.execute({
            name,
            dateOfBirth,
            identificationNumber,
            email,
            initialAmount,
            requestId,
        });

        return {
            statusCode: 201,
            body: JSON.stringify({
                success: true,
                data: result,
                error: null,
            }),
        };
    } catch (error: unknown) {
        const elapsedMs = Date.now() - startTime;

        if (error instanceof ValidationError) {
            console.error(JSON.stringify({
                level: 'error',
                requestId,
                message: error.internalMessage,
                code: error.code,
                fields: error.fields,
                stack: error.stack,
                elapsedMs,
            }));

            return buildErrorResponse(400, error.code, error.userMessage, error.fields);
        }

        if (error instanceof ConflictError) {
            console.error(JSON.stringify({
                level: 'error',
                requestId,
                message: error.internalMessage,
                code: error.code,
                stack: error.stack,
                elapsedMs,
            }));

            return buildErrorResponse(409, error.code, error.userMessage);
        }

        // Unknown error - log full details but never expose internals in response
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;

        console.error(JSON.stringify({
            level: 'error',
            requestId,
            message: errorMessage,
            stack: errorStack,
            elapsedMs,
        }));

        return buildErrorResponse(500, ErrorCodes.INTERNAL_SERVER_ERROR, 'An unexpected error occurred. Please try again later.');
    }
};

/**
 * Builds a standard envelope error response.
 * @param statusCode - The HTTP status code.
 * @param code - The error code from ErrorCodes constant.
 * @param message - A user-facing error message.
 * @param fields - Optional array of field names related to the error.
 * @returns An APIGatewayProxyResult with the standard error envelope.
 */
function buildErrorResponse(
    statusCode: number,
    code: string,
    message: string,
    fields?: string[]
): APIGatewayProxyResult {
    const errorPayload: { code: string; message: string; fields?: string[] } = { code, message };
    if (fields && fields.length > 0) {
        errorPayload.fields = fields;
    }

    return {
        statusCode,
        body: JSON.stringify({
            success: false,
            data: null,
            error: errorPayload,
        }),
    };
}
