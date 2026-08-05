import fc from 'fast-check';
import { AccountNumberGeneratorAdapter } from '@/infrastructure/outputs/account-number-generator-adapter';
import { IAccountRepository } from '@/domain/ports/account-repository';
import { InternalError } from '@/domain/exceptions/internal.error';
import { ErrorCodes } from '@/domain/constants/error-codes';

/**
 * Property-based tests for AccountNumberGeneratorAdapter.
 *
 * **Validates: Requirements 8.1**
 */
describe('AccountNumberGeneratorAdapter - Property Tests', () => {
    let mockAccountRepository: jest.Mocked<IAccountRepository>;
    let generator: AccountNumberGeneratorAdapter;

    beforeEach(() => {
        mockAccountRepository = {
            existsByAccountNumber: jest.fn(),
        } as jest.Mocked<IAccountRepository>;

        generator = new AccountNumberGeneratorAdapter(mockAccountRepository);
    });

    /**
     * Property 9: Account number format invariant
     *
     * For any generated account number produced by the system, it SHALL be exactly
     * 10 characters in length and match the pattern /^\d{10}$/ (all characters are
     * numeric digits).
     */
    describe('Property 9: Account number format invariant', () => {
        it('should always produce a string of exactly 10 characters in length', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.constant(null),
                    async () => {
                        mockAccountRepository.existsByAccountNumber.mockResolvedValue(false);

                        const accountNumber = await generator.generate();

                        return accountNumber.length === 10;
                    }
                ),
                { numRuns: 200 }
            );
        });

        it('should always produce a string matching /^\\d{10}$/ (all numeric digits)', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.constant(null),
                    async () => {
                        mockAccountRepository.existsByAccountNumber.mockResolvedValue(false);

                        const accountNumber = await generator.generate();

                        return /^\d{10}$/.test(accountNumber);
                    }
                ),
                { numRuns: 200 }
            );
        });

        it('should satisfy format invariant across many generations even with retries', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.integer({ min: 0, max: 2 }),
                    async (collisionsBeforeSuccess) => {
                        mockAccountRepository.existsByAccountNumber.mockReset();

                        // Simulate collisions followed by a successful unique check
                        for (let i = 0; i < collisionsBeforeSuccess; i++) {
                            mockAccountRepository.existsByAccountNumber.mockResolvedValueOnce(true);
                        }
                        mockAccountRepository.existsByAccountNumber.mockResolvedValueOnce(false);

                        const accountNumber = await generator.generate();

                        return accountNumber.length === 10 && /^\d{10}$/.test(accountNumber);
                    }
                ),
                { numRuns: 200 }
            );
        });

        it('should throw InternalError with INTERNAL_SERVER_ERROR when all attempts are exhausted', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.constant(null),
                    async () => {
                        mockAccountRepository.existsByAccountNumber.mockResolvedValue(true);

                        try {
                            await generator.generate();
                            return false; // Should have thrown
                        } catch (error) {
                            if (!(error instanceof InternalError)) return false;
                            return error.code === ErrorCodes.INTERNAL_SERVER_ERROR;
                        }
                    }
                ),
                { numRuns: 200 }
            );
        });
    });
});
