import { BaseError } from "./base.error";
export class InvalidEventError extends BaseError {

    constructor(
        internalMessage: string,
        userMessage: string
    ) {
        super(internalMessage, userMessage);
    }

}