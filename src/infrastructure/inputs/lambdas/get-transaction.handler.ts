import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetTransactionUseCase } from '../../../application/get-transaction.use-case';
import { DynamonDBTransactionAdapter } from '../../outputs/dynamondb-transaction-adapter';
import { TransactionNotFoundError } from '../../../domain/exceptions/transaction-not-found.error';
import { BaseError } from '../../../domain/exceptions/base.error';
import { GetTransactionPathParamsSchema, TransactionResponseSchema } from '../schemas/get-transaction.schemas';
import { validateSchema, buildValidationErrorResponse, validateResponse } from '../schemas/validation.helper';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        if (!event.pathParameters) {
            return buildValidationErrorResponse('Los parámetros de ruta son requeridos.');
        }

        const validation = validateSchema(GetTransactionPathParamsSchema, event.pathParameters);
        if (!validation.success) {
            return buildValidationErrorResponse(validation.error);
        }

        const { id } = validation.data;

        const repository = new DynamonDBTransactionAdapter();
        const useCase = new GetTransactionUseCase(repository);

        const transaction = await useCase.execute({ id });

        const serializedTransaction = {
            ...transaction,
            createdAt: transaction.createdAt.toISOString(),
        };
        const validatedResponse = validateResponse(TransactionResponseSchema, serializedTransaction);

        return {
            statusCode: 200,
            body: JSON.stringify(validatedResponse),
        };
    } catch (error) {
        if (error instanceof TransactionNotFoundError) {
            console.error(error.internalMessage);
            return {
                statusCode: 404,
                body: JSON.stringify({ error: error.userMessage }),
            };
        }

        if (error instanceof BaseError) {
            console.error(error.internalMessage);
            return {
                statusCode: 400,
                body: JSON.stringify({ error: error.userMessage }),
            };
        }

        console.error(error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Error interno del servidor' }),
        };
    }
};
