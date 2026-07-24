/**
 * Represents a confirmation message to be published to the queue.
 */
export interface IConfirmationMessage {
    readonly email: string;
    readonly accountNumber: string;
    readonly customerName: string;
    /** ISO 8601 UTC timestamp */
    readonly createdAt: string;
}

/**
 * Defines the contract for publishing confirmation messages
 * to an asynchronous message queue.
 */
export interface IConfirmationQueue {
    /**
     * Publishes a confirmation message to the queue.
     * @param message The confirmation message to publish.
     */
    publish(message: IConfirmationMessage): Promise<void>;
}
