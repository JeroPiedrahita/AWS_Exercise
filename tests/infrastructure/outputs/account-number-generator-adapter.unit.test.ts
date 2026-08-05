import { AccountNumberGeneratorAdapter } from '@/infrastructure/outputs/account-number-generator-adapter';
import { IAccountRepository } from '@/domain/ports/account-repository';
import { InternalError } from '@/domain/exceptions/internal.error';
import { ErrorCodes } from '@/domain/constants/error-codes';

/**
 * Unit tests for AccountNumberGeneratorAdapter - retry exhaustion behavior.
 *
 * **Validates: Requirements 8.4**
 */
describe('AccountNumberGeneratorAdapter - Unit Tests', () => {
    let mockAccountRepository: jest.Mocked<IAccountRepository>;
    let generator: AccountNumberGeneratorAdapter;

    beforeEach(() => {
        mockAccountRepository = {
            existsByAccountNumber: jest.fn(),
        } as jest.Mocked<IAccountRepository>;

        generator = new AccountNumberGeneratorAdapter(mockAccountRepository);
    });

    describe('Retry exhaustion → InternalError', () => {
        it('should throw InternalError with code INTERNAL_SERVER_ERROR when all 3 attempts are exhausted', async () => {
            // existsByAccountNumber returns true for all attempts, simulating all collisions
            mockAccountRepository.existsByAccountNumber.mockResolvedValue(true);

            let thrownError: unknown = null;

            try {
                await generator.generate();
            } catch (error) {
                thrownError = error;
            }

            expect(thrownError).toBeInstanceOf(InternalError);
            expect((thrownError as InternalError).code).toBe(ErrorCodes.INTERNAL_SERVER_ERROR);
        });

        it('should call existsByAccountNumber exactly 3 times before throwing', async () => {
            mockAccountRepository.existsByAccountNumber.mockResolvedValue(true);

            try {
                await generator.generate();
            } catch {
                // Expected
            }

            expect(mockAccountRepository.existsByAccountNumber).toHaveBeenCalledTimes(3);
        });

        it('should succeed on the last attempt if uniqueness check passes', async () => {
            // First two attempts collide, third succeeds
            mockAccountRepository.existsByAccountNumber
                .mockResolvedValueOnce(true)
                .mockResolvedValueOnce(true)
                .mockResolvedValueOnce(false);

            const result = await generator.generate();

            expect(result).toMatch(/^\d{10}$/);
            expect(mockAccountRepository.existsByAccountNumber).toHaveBeenCalledTimes(3);
        });
    });
});
