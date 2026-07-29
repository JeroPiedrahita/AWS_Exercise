/**
 * Defines the operations available for
 * querying account records.
 */
export interface IAccountRepository {
    /**
     * Checks if an account with the given account number already exists.
     * @param accountNumber The 10-digit account number to check.
     * @returns True if an account with that number exists.
     */
    existsByAccountNumber(accountNumber: string): Promise<boolean>;
}
