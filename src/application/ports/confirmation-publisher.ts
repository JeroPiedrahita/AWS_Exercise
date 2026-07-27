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
 * to an asynchronous message.
 */
export interface IConfirmationPublisher {
    publish(message: IConfirmationMessage): Promise<void>;
}
