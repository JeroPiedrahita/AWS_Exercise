
export interface IAccountNumberGenerator {
    /**
     * Generates a unique 10-digit numeric account number.
     */
    generate(): Promise<string>;
}
