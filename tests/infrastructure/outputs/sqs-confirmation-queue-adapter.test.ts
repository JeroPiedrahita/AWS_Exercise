import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { SqsConfirmationQueueAdapter } from '@/infrastructure/outputs/sqs-confirmation-queue-adapter';
import { IConfirmationMessage } from '@/domain/ports/confirmation-publisher';

describe('SqsConfirmationQueueAdapter', () => {
    let adapter: SqsConfirmationQueueAdapter;
    let mockSend: jest.Mock;
    let mockClient: { send: jest.Mock };

    const testMessage: IConfirmationMessage = {
        email: 'john.doe@example.com',
        accountNumber: '1234567890',
        customerName: 'John Doe',
        createdAt: '2024-06-15T10:30:00.000Z',
    };

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.CONFIRMATION_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';

        mockSend = jest.fn().mockResolvedValue({});
        mockClient = { send: mockSend };
        adapter = new SqsConfirmationQueueAdapter(mockClient as unknown as SQSClient);
    });

    afterEach(() => {
        delete process.env.CONFIRMATION_QUEUE_URL;
    });

    describe('publish', () => {
        it('should send a message to the configured SQS queue with JSON-serialized body', async () => {
            await adapter.publish(testMessage);

            expect(mockSend).toHaveBeenCalledTimes(1);
            const command = mockSend.mock.calls[0][0];
            expect(command).toBeInstanceOf(SendMessageCommand);
            expect(command.input).toEqual({
                QueueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue',
                MessageBody: JSON.stringify(testMessage),
            });
        });

        it('should serialize all message fields correctly in the message body', async () => {
            await adapter.publish(testMessage);

            const command = mockSend.mock.calls[0][0];
            const parsedBody = JSON.parse(command.input.MessageBody);

            expect(parsedBody.email).toBe('john.doe@example.com');
            expect(parsedBody.accountNumber).toBe('1234567890');
            expect(parsedBody.customerName).toBe('John Doe');
            expect(parsedBody.createdAt).toBe('2024-06-15T10:30:00.000Z');
        });

        it('should use the default queue URL when CONFIRMATION_QUEUE_URL is not set', async () => {
            delete process.env.CONFIRMATION_QUEUE_URL;
            const adapterWithDefault = new SqsConfirmationQueueAdapter(mockClient as unknown as SQSClient);

            await adapterWithDefault.publish(testMessage);

            const command = mockSend.mock.calls[0][0];
            expect(command.input.QueueUrl).toBe('ConfirmationQueue');
        });

        it('should propagate errors from the SQS client', async () => {
            mockSend.mockRejectedValue(new Error('Queue does not exist'));

            await expect(adapter.publish(testMessage)).rejects.toThrow('Queue does not exist');
        });

        it('should propagate throttling errors from the SQS client', async () => {
            const throttleError = new Error('Rate exceeded');
            throttleError.name = 'ThrottlingException';
            mockSend.mockRejectedValue(throttleError);

            await expect(adapter.publish(testMessage)).rejects.toThrow('Rate exceeded');
        });

        it('should handle messages with special characters in customer name', async () => {
            const messageWithSpecialChars: IConfirmationMessage = {
                email: 'maria@example.com',
                accountNumber: '9876543210',
                customerName: 'María José García-López',
                createdAt: '2024-12-01T00:00:00.000Z',
            };

            await adapter.publish(messageWithSpecialChars);

            const command = mockSend.mock.calls[0][0];
            const parsedBody = JSON.parse(command.input.MessageBody);
            expect(parsedBody.customerName).toBe('María José García-López');
        });
    });
});
