import { BaseError } from "./base.error";

/**
 * Represents an internal server error that occurs during processing.
 * Used when an operation fails due to system-level issues (e.g., resource exhaustion).
 */
export class InternalError extends BaseError {

    constructor(
        public readonly code: string,
        internalMessage: string,
        userMessage: string
    ) {
        super(internalMessage, userMessage);
    }

}
