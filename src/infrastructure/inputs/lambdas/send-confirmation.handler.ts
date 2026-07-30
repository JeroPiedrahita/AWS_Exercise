import { SQSEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { SESClient } from '@aws-sdk/client-ses';
import { SendConfirmationUseCase } from '../../../application/send-confirmation.use-case';
import { DynamoDBCustomerRepository } from '../../outputs/dynamodb-customer-repository';
import { SesEmailServiceAdapter } from '../../outputs/ses-email-service-adapter';
import { IConfirmationMessage } from '../../../domain/ports/confirmation-publisher';

/**
 * Lambda handler for the SQS confirmation queue consumer.
 * Processes SQS event records containing confirmation messages and sends
 * confirmation emails to customers after account creation.
 *
 * On success: the message is automatically deleted from the queue by SQS.
 * On failure: throws an error so SQS retries delivery (up to 3 times before DLQ).
 *
 * @param event - The SQS event containing one or more records to process.
 */
export const handler = async (event: SQSEvent): Promise<void> => {
    // Composition root: instantiate adapters and use case
    const dynamoDBClient = new DynamoDBClient({});
    const sesClient = new SESClient({});

    const customerRepository = new DynamoDBCustomerRepository(dynamoDBClient);
    const emailService = new SesEmailServiceAdapter(sesClient);

    const useCase = new SendConfirmationUseCase(customerRepository, emailService);

    for (const record of event.Records) {
        const requestId = record.messageId;

        try {
            const message: IConfirmationMessage = JSON.parse(record.body);

            await useCase.execute({
                email: message.email,
                accountNumber: message.accountNumber,
                customerName: message.customerName,
                createdAt: message.createdAt,
            });
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;

            console.error(JSON.stringify({
                level: 'error',
                requestId,
                message: errorMessage,
                stack: errorStack,
            }));

            // Re-throw to trigger SQS retry (up to 3 times before DLQ)
            throw error;
        }
    }
};
