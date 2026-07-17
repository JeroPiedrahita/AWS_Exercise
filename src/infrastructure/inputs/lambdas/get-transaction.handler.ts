import { GetTransactionUseCase}from "../../../application/get-transaction.use-case";
import { DynamonDBTransactionAdapter } from "../../outputs/dynamondb-transaction-adapter";
import { TransactionNotFoundError} from  "../../../domain/exceptions/transaction-not-found.error";
import {APIGatewayProxyEvent, APIGatewayProxyResult} from "aws-lambda";
import { InvalidEventError } from "../../../domain/exceptions/invalid-event.error";
import { BaseError } from "../../../domain/exceptions/base.error";

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => { 

    try{

        const id = event.pathParameters?.id;

        if (!id) {
            throw new InvalidEventError(
                "The path parameter 'id' was not provided.",
                "Se necesita el ID de la transacción."
            );
        }
        const repository = new DynamonDBTransactionAdapter();
        const useCase = new GetTransactionUseCase(repository);

        const transaction = await useCase.execute({ id });
        return {
                statusCode: 200,
                body: JSON.stringify(transaction)
            };
    }catch (error){
        if (error instanceof TransactionNotFoundError) {
            console.error(error.internalMessage);

            return{
                statusCode:404,
                body: JSON.stringify({
                    error: error.userMessage
                })
            };
        }

        if (error instanceof BaseError){
            console.error(error.internalMessage);

            return {
                statusCode: 400,
                body: JSON.stringify({
                    error:error.userMessage
                })
            };
        }

        console.error(error);

        return{
            statusCode: 500,
            body: JSON.stringify({
                error: "Error interno del servidor"
            })
        };
    }
};
