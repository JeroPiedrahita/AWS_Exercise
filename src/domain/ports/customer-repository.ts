/**
 * Defines the operations available for
 * querying and updating customer records.
 */
export interface ICustomerRepository {
    /**
     * Checks if a customer with the given normalized identification number already exists.
     * @param normalizedId Lowercase, trimmed identification number.
     * @returns True if a customer with that identification number exists.
     */
    existsByIdentificationNumber(normalizedId: string): Promise<boolean>;
    /**
     * Retrieves the confirmation status for a customer associated with the given account number.
     * @param accountNumber The account number to look up.
     * @returns The ISO 8601 UTC timestamp when confirmation was sent, or null if not yet sent.
     */
    getConfirmationStatus(accountNumber: string): Promise<string | null>;
    /**
     * Marks the confirmation email as sent for the customer associated with the given account number.
     * @param accountNumber The account number to update.
     * @param sentAt ISO 8601 UTC timestamp when the confirmation was sent.
     */
    markConfirmationSent(accountNumber: string, sentAt: string): Promise<void>;
}
