/**
 * Defines the contract for sending emails to customers.
 */
export interface IEmailService {
    /**
     * Sends a confirmation email to the customer after account creation.
     * @param to The recipient email address.
     * @param accountNumber The newly created account number.
     * @param customerName The customer's full name.
     * @param createdAt ISO 8601 UTC timestamp of account creation.
     */
    sendConfirmationEmail(
        to: string,
        accountNumber: string,
        customerName: string,
        createdAt: string
    ): Promise<void>;
}
