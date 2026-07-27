/**
 * Represents a bank customer with personal information and audit metadata.
 */
export interface Customer {
    readonly customerId: string;
    readonly name: string;
    /** ISO 8601 date (YYYY-MM-DD) */
    readonly dateOfBirth: string;
    readonly identificationNumber: string;
    /** Lowercase, trimmed identification number for case-insensitive duplicate detection */
    readonly normalizedIdentificationNumber: string;
    readonly email: string;
    /** ISO 8601 UTC timestamp */
    readonly createdAt: string;
    readonly requestId: string;
    readonly createdBy: string;
    /** ISO 8601 UTC timestamp, set after confirmation email is sent */
    readonly confirmationSentAt?: string;
}
