import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { IEmailService } from "../../application/ports/email-service";

/**
 * SES implementation of the email service port.
 *
 * Sends confirmation emails to customers via AWS SES after
 * account creation. The email contains the account number,
 * customer name, and creation timestamp.
 */
export class SesEmailServiceAdapter implements IEmailService {

    private readonly sourceEmail: string;

    /**
     * Creates a new SesEmailServiceAdapter instance.
     * @param client The SES client used for sending emails.
     */
    constructor(private readonly client: SESClient) {
        this.sourceEmail = process.env.SES_SOURCE_EMAIL || '';
    }

    /**
     * Sends a confirmation email to the customer after account creation.
     * @param to The recipient email address.
     * @param accountNumber The newly created account number.
     * @param customerName The customer's full name.
     * @param createdAt ISO 8601 UTC timestamp of account creation.
     */
    async sendConfirmationEmail(
        to: string,
        accountNumber: string,
        customerName: string,
        createdAt: string
    ): Promise<void> {
        await this.client.send(
            new SendEmailCommand({
                Source: this.sourceEmail,
                Destination: {
                    ToAddresses: [to],
                },
                Message: {
                    Subject: {
                        Data: `Account Creation Confirmation - ${accountNumber}`,
                        Charset: 'UTF-8',
                    },
                    Body: {
                        Text: {
                            Data: `Dear ${customerName},\n\nYour account has been successfully created.\n\nAccount Number: ${accountNumber}\nCustomer Name: ${customerName}\nCreated At: ${createdAt}\n\nThank you for choosing our services.`,
                            Charset: 'UTF-8',
                        },
                    },
                },
            })
        );
    }
}
