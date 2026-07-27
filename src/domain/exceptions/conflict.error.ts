import { BaseError } from "./base.error";

export class ConflictError extends BaseError {

    constructor(
        public readonly code: string,
        internalMessage: string,
        userMessage: string
    ) {
        super(internalMessage, userMessage);
    }

}
