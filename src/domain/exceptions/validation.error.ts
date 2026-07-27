import { BaseError } from "./base.error";

export class ValidationError extends BaseError {

    constructor(
        public readonly code: string,
        public readonly fields: string[] | undefined,
        internalMessage: string,
        userMessage: string
    ) {
        super(internalMessage, userMessage);
    }

}
