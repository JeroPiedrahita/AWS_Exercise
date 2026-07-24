import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ProcessPaymentUseCase } from '../../../application/process-payment.use-cases';
import { DynamonDBTransactionAdapter } from '../../outputs/dynamondb-transaction-adapter';
import { BaseError } from '../../../domain/exceptions/base.error';
import { RegisterPaymentRequestSchema } from '../schemas/register-payment.schemas';
import { validateSchema, buildValidationErrorResponse } from '../schemas/validation.helper';

/**
 * Lambda entry point responsible for processing payment registration requests received
 * through API Gateway.
 * @param event - The API Gateway proxy event containing the request
 * @returns The API Gateway proxy result with appropriate status code and body
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        if (!event || !event.body) {
            return buildValidationErrorResponse('El cuerpo de la solicitud es requerido.');
        }

        let rawBody: unknown;
        try {
            rawBody = JSON.parse(event.body);
        } catch {
            return buildValidationErrorResponse(
                'El cuerpo de la solicitud no tiene un formato JSON válido.'
            );
        }

        const validation = validateSchema(RegisterPaymentRequestSchema, rawBody);
        if (!validation.success) {
            return buildValidationErrorResponse(validation.error);
        }

        const { id, accountId, amount } = validation.data;

        const repository = new DynamonDBTransactionAdapter();
        const useCase = new ProcessPaymentUseCase(repository);
        await useCase.execute(id, accountId, amount);

        return {
            statusCode: 201,
            body: JSON.stringify({ message: 'Transaccion procesada con exito' }),
        };
    } catch (error) {
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
