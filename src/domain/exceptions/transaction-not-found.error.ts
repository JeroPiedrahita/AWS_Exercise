import { BaseError } from "./base.error";

export class TransactionNotFoundError extends BaseError {

    constructor(
        internalMessage: string,
        userMessage: string,
    ){
        super(internalMessage, userMessage);
    }
}