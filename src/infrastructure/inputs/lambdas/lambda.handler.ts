import {ProcessPaymentUseCase }from "../../../application/process-payment.use-cases";
import { DynamonDBTransactionAdapter } from "../../outputs/dynamondb-transaction-adapter";
import { BaseError } from "../../../domain/exceptions/base.error";
import { InvalidEventError} from "../../../domain/exceptions/invalid-event.error";
import {APIGatewayProxyEvent, APIGatewayProxyResult} from "aws-lambda";
/**
 * Lambda entry point responsible for processing payment registration requests received
 * through
 * API Gateway.
 * @param event 
 * @returns 
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        if (!event || !event.body){
            throw new InvalidEventError(
                "The API Getway event does not contain a body.",
                "El evento recibido es inválido."
            );
        }
        let body;

        try{
            body = JSON.parse(event.body);
        }catch{
            throw new InvalidEventError(
                "The request body is not valid JSON.",
                "El cuerpo de la solicitud no tiene un formato válido."
            );
        }

        //1. Start dependecies
        const repository = new DynamonDBTransactionAdapter();
        const useCase = new ProcessPaymentUseCase(repository);

        await useCase.execute(body.id, body.accountId, body.amount);

        return{
            statusCode: 201,
            body: JSON.stringify(
                {message:"Transaccion procesada con exito"})

        };    
    }catch (error: any) {

        if (error instanceof BaseError) {
            console.error(error.internalMessage);
            return {
                statusCode: 400,
                body: JSON.stringify({
                    error: error.userMessage
                })
            };
        }
        console.error(error);

        return {
            statusCode: 500,
            body: JSON.stringify({
                error: "Error interno del servidor"
            })
        };
    }
};