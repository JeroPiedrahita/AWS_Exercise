/**
 * Defines the contract for generating unique account numbers.
 */
export interface IAccountNumberGenerator {
    /**
     * Generates a unique 10-digit numeric account number.
     * @returns A unique account number string.
     */
    generate(): Promise<string>;
}
