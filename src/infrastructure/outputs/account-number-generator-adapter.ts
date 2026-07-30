import { randomInt } from 'crypto';
import { IAccountNumberGenerator } from "../../domain/ports/account-number-generator";
import { IAccountRepository } from "../../domain/ports/account-repository";
import { InternalError } from "../../domain/exceptions/internal.error";
import { ErrorCodes } from "../../domain/constants/error-codes";

const MAX_ATTEMPTS = 3;
const ACCOUNT_NUMBER_LENGTH = 10;

/**
 * Adapter that generates unique 10-digit numeric account numbers.
 *
 * Uses cryptographically secure random number generation and verifies
 * uniqueness against the account repository before returning a candidate.
 * Retries up to 3 times; throws InternalError if all attempts are exhausted.
 */
export class AccountNumberGeneratorAdapter implements IAccountNumberGenerator {

    /**
     * Creates a new AccountNumberGeneratorAdapter instance.
     * @param accountRepository Repository used to verify account number uniqueness.
     */
    constructor(private readonly accountRepository: IAccountRepository) {}

    /**
     * Generates a unique 10-digit numeric account number.
     * @returns A unique 10-digit string consisting of numeric characters only.
     * @throws InternalError if a unique account number cannot be generated after 3 attempts.
     */
    async generate(): Promise<string> {
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            const candidate = this.generateCandidate();
            const exists = await this.accountRepository.existsByAccountNumber(candidate);

            if (!exists) {
                return candidate;
            }
        }

        throw new InternalError(
            ErrorCodes.INTERNAL_SERVER_ERROR,
            `Failed to generate a unique account number after ${MAX_ATTEMPTS} attempts`,
            'An unexpected error occurred. Please try again later.'
        );
    }

    /**
     * Generates a random 10-digit numeric string.
     */
    private generateCandidate(): string {
        let candidate = '';
        for (let i = 0; i < ACCOUNT_NUMBER_LENGTH; i++) {
            candidate += randomInt(0, 10).toString();
        }
        return candidate;
    }

}
