import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { IConfirmationPublisher, IConfirmationMessage } from "../../domain/ports/confirmation-publisher";

/**
 * SQS implementation of the confirmation publisher port.
 *
 * Publishes confirmation messages to an SQS queue for asynchronous
 * processing by the email confirmation consumer Lambda.
 * The message body is a JSON-serialized `IConfirmationMessage`.
 */
export class SqsConfirmationQueueAdapter implements IConfirmationPublisher {

    private readonly queueUrl: string;

    /**
     * Creates a new SqsConfirmationQueueAdapter instance.
     * @param client The SQS client used for sending messages to the queue.
     */
    constructor(private readonly client: SQSClient) {
        this.queueUrl = process.env.CONFIRMATION_QUEUE_URL || 'ConfirmationQueue';
    }

    /**
     * Publishes a confirmation message to the SQS queue.
     * @param message The confirmation message containing email, account number,
     *                customer name, and creation timestamp.
     */
    async publish(message: IConfirmationMessage): Promise<void> {
        await this.client.send(
            new SendMessageCommand({
                QueueUrl: this.queueUrl,
                MessageBody: JSON.stringify(message),
            })
        );
    }
}
