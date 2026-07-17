
export abstract class BaseError extends Error {

    constructor(
        public readonly internalMessage: string,
        public readonly userMessage: string
    ) {
        super(internalMessage);
    }

}
