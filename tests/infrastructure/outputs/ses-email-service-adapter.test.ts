import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { SesEmailServiceAdapter } from '@/infrastructure/outputs/ses-email-service-adapter';

describe('SesEmailServiceAdapter', () => {
    let adapter: SesEmailServiceAdapter;
    let mockSend: jest.Mock;
    let mockClient: { send: jest.Mock };

    const testParams = {
        to: 'john.doe@example.com',
        accountNumber: '1234567890',
        customerName: 'John Doe',
        createdAt: '2024-06-15T10:30:00.000Z',
    };

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.SES_SOURCE_EMAIL = 'noreply@bank.com';

        mockSend = jest.fn().mockResolvedValue({ MessageId: 'msg-001' });
        mockClient = { send: mockSend };
        adapter = new SesEmailServiceAdapter(mockClient as unknown as SESClient);
    });

    afterEach(() => {
        delete process.env.SES_SOURCE_EMAIL;
    });

    describe('sendConfirmationEmail', () => {
        it('should send an email via SES with correct source and destination', async () => {
            await adapter.sendConfirmationEmail(
                testParams.to,
                testParams.accountNumber,
                testParams.customerName,
                testParams.createdAt
            );

            expect(mockSend).toHaveBeenCalledTimes(1);
            const command = mockSend.mock.calls[0][0];
            expect(command).toBeInstanceOf(SendEmailCommand);
            expect(command.input.Source).toBe('noreply@bank.com');
            expect(command.input.Destination).toEqual({
                ToAddresses: ['john.doe@example.com'],
            });
        });

        it('should include the account number in the email subject', async () => {
            await adapter.sendConfirmationEmail(
                testParams.to,
                testParams.accountNumber,
                testParams.customerName,
                testParams.createdAt
            );

            const command = mockSend.mock.calls[0][0];
            expect(command.input.Message.Subject.Data).toBe('Account Creation Confirmation - 1234567890');
            expect(command.input.Message.Subject.Charset).toBe('UTF-8');
        });

        it('should include account number, customer name, and creation timestamp in the body', async () => {
            await adapter.sendConfirmationEmail(
                testParams.to,
                testParams.accountNumber,
                testParams.customerName,
                testParams.createdAt
            );

            const command = mockSend.mock.calls[0][0];
            const bodyText = command.input.Message.Body.Text.Data;

            expect(bodyText).toContain('John Doe');
            expect(bodyText).toContain('1234567890');
            expect(bodyText).toContain('2024-06-15T10:30:00.000Z');
            expect(command.input.Message.Body.Text.Charset).toBe('UTF-8');
        });

        it('should format the email body with a greeting and account details', async () => {
            await adapter.sendConfirmationEmail(
                testParams.to,
                testParams.accountNumber,
                testParams.customerName,
                testParams.createdAt
            );

            const command = mockSend.mock.calls[0][0];
            const bodyText = command.input.Message.Body.Text.Data;

            expect(bodyText).toContain('Dear John Doe');
            expect(bodyText).toContain('Account Number: 1234567890');
            expect(bodyText).toContain('Customer Name: John Doe');
            expect(bodyText).toContain('Created At: 2024-06-15T10:30:00.000Z');
        });

        it('should use empty string as source email when SES_SOURCE_EMAIL is not set', async () => {
            delete process.env.SES_SOURCE_EMAIL;
            const adapterWithDefault = new SesEmailServiceAdapter(mockClient as unknown as SESClient);

            await adapterWithDefault.sendConfirmationEmail(
                testParams.to,
                testParams.accountNumber,
                testParams.customerName,
                testParams.createdAt
            );

            const command = mockSend.mock.calls[0][0];
            expect(command.input.Source).toBe('');
        });

        it('should propagate errors from the SES client', async () => {
            mockSend.mockRejectedValue(new Error('Email address is not verified'));

            await expect(
                adapter.sendConfirmationEmail(
                    testParams.to,
                    testParams.accountNumber,
                    testParams.customerName,
                    testParams.createdAt
                )
            ).rejects.toThrow('Email address is not verified');
        });

        it('should propagate throttling errors from the SES client', async () => {
            const throttleError = new Error('Maximum sending rate exceeded');
            throttleError.name = 'Throttling';
            mockSend.mockRejectedValue(throttleError);

            await expect(
                adapter.sendConfirmationEmail(
                    testParams.to,
                    testParams.accountNumber,
                    testParams.customerName,
                    testParams.createdAt
                )
            ).rejects.toThrow('Maximum sending rate exceeded');
        });

        it('should handle customer names with special characters', async () => {
            await adapter.sendConfirmationEmail(
                'maria@example.com',
                '9876543210',
                'María José García-López',
                '2024-12-01T00:00:00.000Z'
            );

            const command = mockSend.mock.calls[0][0];
            const bodyText = command.input.Message.Body.Text.Data;

            expect(bodyText).toContain('Dear María José García-López');
            expect(bodyText).toContain('Customer Name: María José García-López');
        });
    });
});
