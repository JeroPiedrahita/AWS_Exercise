import fc from 'fast-check';
import { SendConfirmationUseCase, ISendConfirmationRequest } from '@/application/send-confirmation.use-case';
import { ICustomerRepository } from '@/domain/ports/customer-repository';
import { IEmailService } from '@/domain/ports/email-service';

/**
 * Property-based tests for SendConfirmationUseCase.
 */
describe('SendConfirmationUseCase - Property Tests', () => {
    let mockCustomerRepository: jest.Mocked<ICustomerRepository>;
    let mockEmailService: jest.Mocked<IEmailService>;
    let useCase: SendConfirmationUseCase;

    beforeEach(() => {
        mockCustomerRepository = {
            existsByIdentificationNumber: jest.fn(),
            getConfirmationStatus: jest.fn(),
            markConfirmationSent: jest.fn(),
        } as jest.Mocked<ICustomerRepository>;

        mockEmailService = {
            sendConfirmationEmail: jest.fn(),
        } as jest.Mocked<IEmailService>;

        useCase = new SendConfirmationUseCase(mockCustomerRepository, mockEmailService);
    });

    // --- Generators ---

    /**
     * Generates a valid email address.
     */
    function validEmail(): fc.Arbitrary<string> {
        return fc.tuple(
            fc.string({ minLength: 1, maxLength: 10, unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')) }),
            fc.string({ minLength: 1, maxLength: 10, unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')) }),
        ).map(([local, domain]) => `${local}@${domain}.com`);
    }

    /**
     * Generates a valid 10-digit account number.
     */
    function validAccountNumber(): fc.Arbitrary<string> {
        return fc.string({ minLength: 10, maxLength: 10, unit: fc.constantFrom(...'0123456789'.split('')) });
    }

    /**
     * Generates a valid customer name.
     */
    function validCustomerName(): fc.Arbitrary<string> {
        return fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);
    }

    /**
     * Generates a valid ISO 8601 UTC timestamp.
     */
    function validCreatedAt(): fc.Arbitrary<string> {
        return fc.record({
            year: fc.integer({ min: 2020, max: 2030 }),
            month: fc.integer({ min: 1, max: 12 }),
            day: fc.integer({ min: 1, max: 28 }),
            hour: fc.integer({ min: 0, max: 23 }),
            minute: fc.integer({ min: 0, max: 59 }),
            second: fc.integer({ min: 0, max: 59 }),
        }).map(({ year, month, day, hour, minute, second }) => {
            const d = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
            return d.toISOString();
        });
    }

    /**
     * Generates a valid ISendConfirmationRequest.
     */
    function validRequest(): fc.Arbitrary<ISendConfirmationRequest> {
        return fc.record({
            email: validEmail(),
            accountNumber: validAccountNumber(),
            customerName: validCustomerName(),
            createdAt: validCreatedAt(),
        });
    }

    /**
     * Generates a non-null ISO 8601 timestamp representing a previously sent confirmation.
     */
    function existingConfirmationTimestamp(): fc.Arbitrary<string> {
        return fc.record({
            year: fc.integer({ min: 2020, max: 2030 }),
            month: fc.integer({ min: 1, max: 12 }),
            day: fc.integer({ min: 1, max: 28 }),
            hour: fc.integer({ min: 0, max: 23 }),
            minute: fc.integer({ min: 0, max: 59 }),
            second: fc.integer({ min: 0, max: 59 }),
        }).map(({ year, month, day, hour, minute, second }) => {
            const d = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
            return d.toISOString();
        });
    }

    // --- Property 13: Consumer idempotency ---
    /**
     * Property 13: Consumer idempotency
     *
     * The Confirmation_Consumer SHALL be idempotent: processing the same message more than once
     * for the same accountNumber SHALL NOT result in duplicate confirmation emails sent to the customer.
     *
     * Sub-properties:
     * - If getConfirmationStatus() returns a non-null timestamp (already sent), then
     *   sendConfirmationEmail() must NOT be called and markConfirmationSent() must NOT be called.
     * - If getConfirmationStatus() returns null (first time), the email should be sent and
     *   confirmation should be marked as sent.
     * - If the same message is processed multiple times, the email service should only be called once.
     *
     * **Validates: Requirements 10.5**
     */
    describe('Property 13: Consumer idempotency', () => {
        it('should NOT send email or mark confirmation when confirmation was already sent', async () => {
            await fc.assert(
                fc.asyncProperty(
                    validRequest(),
                    existingConfirmationTimestamp(),
                    async (request, previouslySentAt) => {
                        jest.clearAllMocks();

                        // Simulate that confirmation was already sent
                        mockCustomerRepository.getConfirmationStatus.mockResolvedValue(previouslySentAt);

                        await useCase.execute(request);

                        // Email must NOT be sent (idempotent skip)
                        expect(mockEmailService.sendConfirmationEmail).not.toHaveBeenCalled();
                        // markConfirmationSent must NOT be called
                        expect(mockCustomerRepository.markConfirmationSent).not.toHaveBeenCalled();
                        // getConfirmationStatus must have been called with the correct account number
                        expect(mockCustomerRepository.getConfirmationStatus).toHaveBeenCalledWith(request.accountNumber);

                        return true;
                    }
                ),
                { numRuns: 200 }
            );
        });

        it('should send email and mark confirmation when confirmation has not been sent yet', async () => {
            await fc.assert(
                fc.asyncProperty(
                    validRequest(),
                    async (request) => {
                        jest.clearAllMocks();

                        // Simulate first-time processing (no confirmation sent yet)
                        mockCustomerRepository.getConfirmationStatus.mockResolvedValue(null);
                        mockEmailService.sendConfirmationEmail.mockResolvedValue(undefined);
                        mockCustomerRepository.markConfirmationSent.mockResolvedValue(undefined);

                        await useCase.execute(request);

                        // Email must be sent exactly once
                        expect(mockEmailService.sendConfirmationEmail).toHaveBeenCalledTimes(1);
                        expect(mockEmailService.sendConfirmationEmail).toHaveBeenCalledWith(
                            request.email,
                            request.accountNumber,
                            request.customerName,
                            request.createdAt
                        );
                        // Confirmation must be marked as sent exactly once
                        expect(mockCustomerRepository.markConfirmationSent).toHaveBeenCalledTimes(1);
                        expect(mockCustomerRepository.markConfirmationSent).toHaveBeenCalledWith(
                            request.accountNumber,
                            expect.any(String)
                        );

                        return true;
                    }
                ),
                { numRuns: 200 }
            );
        });

        it('should only send email once when the same message is processed multiple times', async () => {
            await fc.assert(
                fc.asyncProperty(
                    validRequest(),
                    fc.integer({ min: 2, max: 5 }),
                    async (request, repeatCount) => {
                        jest.clearAllMocks();

                        let sentTimestamp: string | null = null;

                        // Simulate stateful behavior: first call returns null, subsequent calls return timestamp
                        mockCustomerRepository.getConfirmationStatus.mockImplementation(async () => {
                            return sentTimestamp;
                        });
                        mockEmailService.sendConfirmationEmail.mockResolvedValue(undefined);
                        mockCustomerRepository.markConfirmationSent.mockImplementation(async (_accountNumber, sentAt) => {
                            sentTimestamp = sentAt;
                        });

                        // Process the same message multiple times
                        for (let i = 0; i < repeatCount; i++) {
                            await useCase.execute(request);
                        }

                        // Email must have been sent exactly once despite multiple executions
                        expect(mockEmailService.sendConfirmationEmail).toHaveBeenCalledTimes(1);
                        // markConfirmationSent must have been called exactly once
                        expect(mockCustomerRepository.markConfirmationSent).toHaveBeenCalledTimes(1);

                        return true;
                    }
                ),
                { numRuns: 200 }
            );
        });
    });

    // --- Error propagation: getConfirmationStatus failure ---
    /**
     * Branch coverage: getConfirmationStatus() throws an exception.
     *
     * When the repository fails to retrieve the confirmation status, the exception must propagate
     * to the caller. Neither the email service nor markConfirmationSent should be invoked because
     * the use case cannot determine whether the confirmation was already sent.
     */
    describe('Error propagation: getConfirmationStatus failure', () => {
        it('should propagate the error and NOT call sendConfirmationEmail or markConfirmationSent', async () => {
            await fc.assert(
                fc.asyncProperty(
                    validRequest(),
                    fc.string({ minLength: 1, maxLength: 50 }),
                    async (request, errorMessage) => {
                        jest.clearAllMocks();

                        const repositoryError = new Error(errorMessage);
                        mockCustomerRepository.getConfirmationStatus.mockRejectedValue(repositoryError);

                        // The exception must propagate
                        await expect(useCase.execute(request)).rejects.toThrow(errorMessage);

                        // sendConfirmationEmail must NOT be called
                        expect(mockEmailService.sendConfirmationEmail).not.toHaveBeenCalled();
                        // markConfirmationSent must NOT be called
                        expect(mockCustomerRepository.markConfirmationSent).not.toHaveBeenCalled();

                        return true;
                    }
                ),
                { numRuns: 200 }
            );
        });
    });

    // --- Error propagation: sendConfirmationEmail failure ---
    /**
     * Branch coverage: sendConfirmationEmail() throws an exception.
     *
     * When the email service fails after the idempotency check passes (getConfirmationStatus
     * returned null), the exception must propagate. markConfirmationSent must NOT be called
     * because the email was never delivered. The confirmation status must have been checked
     * before the attempt to send.
     */
    describe('Error propagation: sendConfirmationEmail failure', () => {
        it('should propagate the error, NOT call markConfirmationSent, and have checked confirmation status first', async () => {
            await fc.assert(
                fc.asyncProperty(
                    validRequest(),
                    fc.string({ minLength: 1, maxLength: 50 }),
                    async (request, errorMessage) => {
                        jest.clearAllMocks();

                        // First-time processing: no confirmation sent yet
                        mockCustomerRepository.getConfirmationStatus.mockResolvedValue(null);

                        const emailError = new Error(errorMessage);
                        mockEmailService.sendConfirmationEmail.mockRejectedValue(emailError);

                        // The exception must propagate
                        await expect(useCase.execute(request)).rejects.toThrow(errorMessage);

                        // Verify confirmation status was checked before the email attempt
                        expect(mockCustomerRepository.getConfirmationStatus).toHaveBeenCalledTimes(1);
                        expect(mockCustomerRepository.getConfirmationStatus).toHaveBeenCalledWith(request.accountNumber);

                        // markConfirmationSent must NOT be called (email failed, cannot mark as sent)
                        expect(mockCustomerRepository.markConfirmationSent).not.toHaveBeenCalled();

                        return true;
                    }
                ),
                { numRuns: 200 }
            );
        });
    });

    // --- Error propagation: markConfirmationSent failure ---
    /**
     * Branch coverage: markConfirmationSent() throws an exception.
     *
     * When the repository fails to record that the confirmation was sent (after the email was
     * already delivered), the exception must propagate. sendConfirmationEmail must have been
     * called exactly once (email was delivered). getConfirmationStatus must have been checked
     * before the email was sent.
     */
    describe('Error propagation: markConfirmationSent failure', () => {
        it('should propagate the error after email was sent, confirming getConfirmationStatus was called first', async () => {
            await fc.assert(
                fc.asyncProperty(
                    validRequest(),
                    fc.string({ minLength: 1, maxLength: 50 }),
                    async (request, errorMessage) => {
                        jest.clearAllMocks();

                        // First-time processing: no confirmation sent yet
                        mockCustomerRepository.getConfirmationStatus.mockResolvedValue(null);
                        // Email sends successfully
                        mockEmailService.sendConfirmationEmail.mockResolvedValue(undefined);

                        const markError = new Error(errorMessage);
                        mockCustomerRepository.markConfirmationSent.mockRejectedValue(markError);

                        // The exception must propagate
                        await expect(useCase.execute(request)).rejects.toThrow(errorMessage);

                        // Verify confirmation status was checked first
                        expect(mockCustomerRepository.getConfirmationStatus).toHaveBeenCalledTimes(1);
                        expect(mockCustomerRepository.getConfirmationStatus).toHaveBeenCalledWith(request.accountNumber);

                        // Email must have been sent exactly once before the failure
                        expect(mockEmailService.sendConfirmationEmail).toHaveBeenCalledTimes(1);
                        expect(mockEmailService.sendConfirmationEmail).toHaveBeenCalledWith(
                            request.email,
                            request.accountNumber,
                            request.customerName,
                            request.createdAt
                        );

                        return true;
                    }
                ),
                { numRuns: 200 }
            );
        });
    });
});
