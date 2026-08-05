import fc from 'fast-check';
import { CreateCustomerAccountUseCase, ICreateCustomerAccountRequest } from '@/application/create-customer-account.use-case';
import { ICustomerRepository } from '@/domain/ports/customer-repository';
import { ICustomerAccountRepository } from '@/domain/ports/customer-account-repository';
import { IAccountNumberGenerator } from '@/domain/ports/account-number-generator';
import { IConfirmationPublisher } from '@/domain/ports/confirmation-publisher';
import { ValidationError } from '@/domain/exceptions/validation.error';
import { ConflictError } from '@/domain/exceptions/conflict.error';
import { ErrorCodes } from '@/domain/constants/error-codes';
import { Customer } from '@/domain/entities/customer';
import { Account } from '@/domain/entities/account';

/**
 * Property-based tests for CreateCustomerAccountUseCase.
 */
describe('CreateCustomerAccountUseCase - Property Tests', () => {
    let mockCustomerRepository: jest.Mocked<ICustomerRepository>;
    let mockCustomerAccountRepository: jest.Mocked<ICustomerAccountRepository>;
    let mockAccountNumberGenerator: jest.Mocked<IAccountNumberGenerator>;
    let mockConfirmationQueue: jest.Mocked<IConfirmationPublisher>;
    let useCase: CreateCustomerAccountUseCase;

    beforeEach(() => {
        mockCustomerRepository = {
            existsByIdentificationNumber: jest.fn(),
            getConfirmationStatus: jest.fn(),
            markConfirmationSent: jest.fn(),
        } as jest.Mocked<ICustomerRepository>;

        mockCustomerAccountRepository = {
            saveCustomerAndAccount: jest.fn(),
        } as jest.Mocked<ICustomerAccountRepository>;

        mockAccountNumberGenerator = {
            generate: jest.fn(),
        } as jest.Mocked<IAccountNumberGenerator>;

        mockConfirmationQueue = {
            publish: jest.fn(),
        } as jest.Mocked<IConfirmationPublisher>;

        useCase = new CreateCustomerAccountUseCase(
            mockCustomerRepository,
            mockCustomerAccountRepository,
            mockAccountNumberGenerator,
            mockConfirmationQueue
        );
    });

    // --- Generators ---

    /**
     * Generates a valid amount in [0, 999999999.99] with at most 2 decimal places.
     */
    function validAmount(): fc.Arbitrary<number> {
        return fc.integer({ min: 0, max: 99999999999 }).map(n => n / 100);
    }

    /**
     * Generates a valid non-empty name string.
     */
    function validName(): fc.Arbitrary<string> {
        return fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);
    }

    /**
     * Generates a valid date of birth that guarantees age >= 18.
     * Uses years between 1950-2000 to always be at least 18.
     */
    function validDateOfBirth(): fc.Arbitrary<string> {
        return fc.record({
            year: fc.integer({ min: 1950, max: 2000 }),
            month: fc.integer({ min: 1, max: 12 }),
            day: fc.integer({ min: 1, max: 28 }),
        }).map(({ year, month, day }) =>
            `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        );
    }

    /**
     * Generates a valid email in a simple format.
     */
    function validEmail(): fc.Arbitrary<string> {
        return fc.tuple(
            fc.string({ minLength: 1, maxLength: 10, unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')) }),
            fc.string({ minLength: 1, maxLength: 10, unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')) }),
        ).map(([local, domain]) => `${local}@${domain}.com`);
    }

    /**
     * Generates a valid non-empty identification number string.
     */
    function validIdentificationNumber(): fc.Arbitrary<string> {
        return fc.string({ minLength: 1, maxLength: 20, unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')) })
            .filter(s => s.trim().length > 0);
    }

    /**
     * Generates a valid full request.
     */
    function validRequest(): fc.Arbitrary<ICreateCustomerAccountRequest> {
        return fc.record({
            name: validName(),
            dateOfBirth: validDateOfBirth(),
            identificationNumber: validIdentificationNumber(),
            email: validEmail(),
            initialAmount: validAmount(),
            requestId: fc.uuid(),
        });
    }

    // --- Property 1: Valid request response correctness ---
    /**
     * Property 1: Valid request response correctness
     *
     * For any valid customer creation request (name non-empty, age ≥ 18, valid email format,
     * amount in [0, 999999999.99] with ≤ 2 decimal places, unique identification number),
     * the response SHALL contain an accountNumber matching /^\d{10}$/, status equal to "ACTIVE",
     * and balance exactly equal to the provided initialAmount.
     *
     * **Validates: Requirements 1.3, 8.3**
     */
    describe('Property 1: Valid request response correctness', () => {
        it('should return accountNumber matching /^\\d{10}$/, status "ACTIVE", and balance equal to initialAmount', async () => {
            await fc.assert(
                fc.asyncProperty(
                    validRequest(),
                    async (request) => {
                        // Setup mocks for a valid request path
                        mockCustomerRepository.existsByIdentificationNumber.mockResolvedValue(false);
                        mockAccountNumberGenerator.generate.mockResolvedValue('1234567890');
                        mockCustomerAccountRepository.saveCustomerAndAccount.mockResolvedValue(undefined);
                        mockConfirmationQueue.publish.mockResolvedValue(undefined);

                        const response = await useCase.execute(request);

                        // Account number must be exactly 10 digits
                        expect(response.accountNumber).toMatch(/^\d{10}$/);
                        // Status must be ACTIVE
                        expect(response.status).toBe('ACTIVE');
                        // Balance must equal provided initialAmount
                        expect(response.balance).toBe(request.initialAmount);
                    }
                ),
                { numRuns: 200 }
            );
        });
    });

    // --- Property 2: Missing field detection completeness ---
    /**
     * Property 2: Missing field detection completeness
     *
     * For any request where a subset of required fields (name, dateOfBirth, identificationNumber,
     * email, initialAmount) is missing — where "missing" means the field is absent, null, or an
     * empty string — the error response SHALL list exactly those field names that are missing,
     * with no false positives and no false negatives.
     *
     * Tests all three "missing" representations: undefined, null, and empty string.
     *
     * **Validates: Requirements 2.1, 2.2, 2.3**
     */
    describe('Property 2: Missing field detection completeness', () => {
        const allFields = ['name', 'dateOfBirth', 'identificationNumber', 'email', 'initialAmount'] as const;
        type FieldName = typeof allFields[number];

        /**
         * Generates a "missing" representation for a field.
         * - For string fields: undefined, null, or empty string
         * - For initialAmount: undefined or null
         */
        function missingValueForField(field: FieldName): fc.Arbitrary<unknown> {
            if (field === 'initialAmount') {
                return fc.constantFrom(undefined, null);
            }
            return fc.constantFrom(undefined, null, '');
        }

        /**
         * Helper: asserts that the ValidationError reports exactly the expected missing fields.
         */
        function assertExactFieldMatch(error: ValidationError, expectedMissing: readonly FieldName[]): boolean {
            const reportedFields = error.fields ?? [];
            const missingSet = new Set<string>(expectedMissing);
            const reportedSet = new Set<string>(reportedFields);

            // Sets must be the same size (quick check for exact match)
            if (missingSet.size !== reportedSet.size) return false;

            // No false negatives: every expected missing field is reported
            for (const f of missingSet) {
                if (!reportedSet.has(f)) return false;
            }
            // No false positives: every reported field is actually missing
            for (const f of reportedSet) {
                if (!missingSet.has(f)) return false;
            }

            return true;
        }

        it('should report exactly the missing fields for any combination of undefined, null, and empty string', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.subarray([...allFields], { minLength: 1 }),
                    fc.constantFrom('undefined', 'null', 'empty') as fc.Arbitrary<'undefined' | 'null' | 'empty'>,
                    validRequest(),
                    async (missingFields, missingStrategy, baseRequest) => {
                        const request = { ...baseRequest } as Record<string, unknown>;

                        for (const field of missingFields) {
                            if (missingStrategy === 'undefined') {
                                request[field] = undefined;
                            } else if (missingStrategy === 'null') {
                                request[field] = null;
                            } else {
                                // 'empty' — empty string for string fields, undefined for initialAmount
                                request[field] = field === 'initialAmount' ? undefined : '';
                            }
                        }

                        try {
                            await useCase.execute(request as unknown as ICreateCustomerAccountRequest);
                            // Should have thrown — test failure
                            return false;
                        } catch (error) {
                            if (!(error instanceof ValidationError)) return false;
                            if (error.code !== ErrorCodes.MISSING_REQUIRED_FIELD) return false;

                            return assertExactFieldMatch(error, missingFields);
                        }
                    }
                ),
                { numRuns: 300 }
            );
        });

        it('should report exactly the missing fields when each field uses a randomly chosen missing representation', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.subarray([...allFields], { minLength: 1 }).chain((fields) =>
                        fc.tuple(
                            fc.constant(fields),
                            fc.tuple(...fields.map((f) => missingValueForField(f)))
                        )
                    ),
                    validRequest(),
                    async ([missingFields, missingValues], baseRequest) => {
                        const request = { ...baseRequest } as Record<string, unknown>;

                        for (let i = 0; i < missingFields.length; i++) {
                            const field = missingFields[i] as string;
                            request[field] = missingValues[i];
                        }

                        try {
                            await useCase.execute(request as unknown as ICreateCustomerAccountRequest);
                            return false;
                        } catch (error) {
                            if (!(error instanceof ValidationError)) return false;
                            if (error.code !== ErrorCodes.MISSING_REQUIRED_FIELD) return false;

                            return assertExactFieldMatch(error, missingFields);
                        }
                    }
                ),
                { numRuns: 300 }
            );
        });
    });

    // --- Property 6: Identification number duplicate detection is case-insensitive and trim-aware ---
    /**
     * Property 6: Identification number duplicate detection is case-insensitive and trim-aware
     *
     * For any identification number string `s` already persisted, a subsequent request with an
     * identification number that equals `s` after trimming leading/trailing whitespace and
     * converting to lowercase SHALL be rejected with error code ACCOUNT_ALREADY_EXISTS.
     *
     * Additionally validates that the Use Case normalizes the identifier (trim + lowercase)
     * before consulting the repository, eliminating false positives from an always-true mock.
     *
     * **Validates: Requirements 5.1**
     */
    describe('Property 6: Identification number duplicate detection is case-insensitive and trim-aware', () => {
        it('should normalize the identification number (trim + lowercase) before querying the repository', async () => {
            await fc.assert(
                fc.asyncProperty(
                    validRequest(),
                    fc.string({ minLength: 0, maxLength: 3, unit: fc.constantFrom(' ', '\t') }),
                    fc.string({ minLength: 0, maxLength: 3, unit: fc.constantFrom(' ', '\t') }),
                    fc.boolean(),
                    async (baseRequest, leadingWhitespace, trailingWhitespace, toUpperCase) => {
                        jest.clearAllMocks();

                        // Create a variant identification number with different casing/whitespace
                        const baseId = baseRequest.identificationNumber;
                        const casedId = toUpperCase ? baseId.toUpperCase() : baseId;
                        const variantId = leadingWhitespace + casedId + trailingWhitespace;

                        const request: ICreateCustomerAccountRequest = {
                            ...baseRequest,
                            identificationNumber: variantId,
                        };

                        // Expected normalized value: trim + lowercase
                        const expectedNormalized = variantId.trim().toLowerCase();

                        // Mock returns true (duplicate exists) for the normalized value
                        mockCustomerRepository.existsByIdentificationNumber.mockResolvedValue(true);

                        try {
                            await useCase.execute(request);
                            return false;
                        } catch (error) {
                            if (!(error instanceof ConflictError)) return false;
                            if (error.code !== ErrorCodes.ACCOUNT_ALREADY_EXISTS) return false;

                            // CRITICAL: verify the repository was called with the normalized value
                            expect(mockCustomerRepository.existsByIdentificationNumber).toHaveBeenCalledTimes(1);
                            const queriedValue = mockCustomerRepository.existsByIdentificationNumber.mock.calls[0]![0];
                            expect(queriedValue).toBe(expectedNormalized);

                            return true;
                        }
                    }
                ),
                { numRuns: 200 }
            );
        });

        it('should pass through when repository returns false for the normalized identifier', async () => {
            await fc.assert(
                fc.asyncProperty(
                    validRequest(),
                    fc.string({ minLength: 0, maxLength: 3, unit: fc.constantFrom(' ', '\t') }),
                    fc.string({ minLength: 0, maxLength: 3, unit: fc.constantFrom(' ', '\t') }),
                    fc.boolean(),
                    async (baseRequest, leadingWhitespace, trailingWhitespace, toUpperCase) => {
                        jest.clearAllMocks();

                        const baseId = baseRequest.identificationNumber;
                        const casedId = toUpperCase ? baseId.toUpperCase() : baseId;
                        const variantId = leadingWhitespace + casedId + trailingWhitespace;

                        const request: ICreateCustomerAccountRequest = {
                            ...baseRequest,
                            identificationNumber: variantId,
                        };

                        const expectedNormalized = variantId.trim().toLowerCase();

                        // Mock returns false (no duplicate) — should proceed to account creation
                        mockCustomerRepository.existsByIdentificationNumber.mockResolvedValue(false);
                        mockAccountNumberGenerator.generate.mockResolvedValue('1234567890');
                        mockCustomerAccountRepository.saveCustomerAndAccount.mockResolvedValue(undefined);
                        mockConfirmationQueue.publish.mockResolvedValue(undefined);

                        const response = await useCase.execute(request);

                        // Verify normalization happened correctly even on the non-duplicate path
                        expect(mockCustomerRepository.existsByIdentificationNumber).toHaveBeenCalledTimes(1);
                        const queriedValue = mockCustomerRepository.existsByIdentificationNumber.mock.calls[0]![0];
                        expect(queriedValue).toBe(expectedNormalized);

                        // Response should succeed
                        expect(response.accountNumber).toMatch(/^\d{10}$/);
                        expect(response.status).toBe('ACTIVE');

                        return true;
                    }
                ),
                { numRuns: 200 }
            );
        });
    });

    // --- Property 8: Persisted data integrity with audit fields ---
    /**
     * Property 8: Persisted data integrity with audit fields
     *
     * When saveCustomerAndAccount is called, the Customer entity must contain all request fields
     * plus audit fields (customerId, createdAt, requestId, createdBy) and normalizedIdentificationNumber,
     * and the Account entity must contain all computed fields plus audit fields.
     *
     * **Validates: Requirements 7.1, 7.2, 7.3, 7.4**
     */
    describe('Property 8: Persisted data integrity with audit fields', () => {
        it('should persist Customer and Account entities with all required fields and audit metadata', async () => {
            await fc.assert(
                fc.asyncProperty(
                    validRequest(),
                    async (request) => {
                        jest.clearAllMocks();
                        mockCustomerRepository.existsByIdentificationNumber.mockResolvedValue(false);
                        mockAccountNumberGenerator.generate.mockResolvedValue('9876543210');
                        mockCustomerAccountRepository.saveCustomerAndAccount.mockResolvedValue(undefined);
                        mockConfirmationQueue.publish.mockResolvedValue(undefined);

                        await useCase.execute(request);

                        expect(mockCustomerAccountRepository.saveCustomerAndAccount).toHaveBeenCalledTimes(1);

                        const [customer, account] = mockCustomerAccountRepository.saveCustomerAndAccount.mock.calls[0] as [Customer, Account];

                        // Customer entity contains all request fields
                        expect(customer.name).toBe(request.name);
                        expect(customer.dateOfBirth).toBe(request.dateOfBirth);
                        expect(customer.identificationNumber).toBe(request.identificationNumber);
                        expect(customer.email).toBe(request.email);

                        // Customer has normalizedIdentificationNumber
                        expect(customer.normalizedIdentificationNumber).toBe(
                            request.identificationNumber.trim().toLowerCase()
                        );

                        // Customer audit fields
                        expect(customer.customerId).toBeDefined();
                        expect(customer.customerId.length).toBeGreaterThan(0);
                        expect(customer.createdAt).toBeDefined();
                        expect(new Date(customer.createdAt).toISOString()).toBe(customer.createdAt);
                        expect(customer.requestId).toBe(request.requestId);
                        expect(customer.createdBy).toBe('customer-account-service');

                        // Account entity contains computed fields
                        expect(account.accountNumber).toBe('9876543210');
                        expect(account.balance).toBe(request.initialAmount);
                        expect(account.status).toBe('ACTIVE');
                        expect(account.customerId).toBe(customer.customerId);

                        // Account audit fields
                        expect(account.accountId).toBeDefined();
                        expect(account.accountId.length).toBeGreaterThan(0);
                        expect(account.createdAt).toBe(customer.createdAt);
                        expect(account.requestId).toBe(request.requestId);
                        expect(account.createdBy).toBe('customer-account-service');

                        return true;
                    }
                ),
                { numRuns: 200 }
            );
        });
    });

    // --- Property 11: SQS message published with required fields after persistence ---
    /**
     * Property 11: SQS message published with required fields after persistence
     *
     * After successful persistence, the confirmationQueue.publish must be called with a message
     * containing: email (matching request), accountNumber (matching response), customerName
     * (matching request.name), and createdAt (ISO 8601 UTC format).
     *
     * **Validates: Requirements 10.1, 10.6**
     */
    describe('Property 11: SQS message published with required fields after persistence', () => {
        it('should publish confirmation message with email, accountNumber, customerName, and ISO 8601 createdAt', async () => {
            await fc.assert(
                fc.asyncProperty(
                    validRequest(),
                    async (request) => {
                        jest.clearAllMocks();
                        mockCustomerRepository.existsByIdentificationNumber.mockResolvedValue(false);
                        mockAccountNumberGenerator.generate.mockResolvedValue('5555555555');
                        mockCustomerAccountRepository.saveCustomerAndAccount.mockResolvedValue(undefined);
                        mockConfirmationQueue.publish.mockResolvedValue(undefined);

                        const response = await useCase.execute(request);

                        expect(mockConfirmationQueue.publish).toHaveBeenCalledTimes(1);

                        const publishedMessage = mockConfirmationQueue.publish.mock.calls[0]![0];

                        // Email matches request
                        expect(publishedMessage.email).toBe(request.email);
                        // Account number matches response
                        expect(publishedMessage.accountNumber).toBe(response.accountNumber);
                        // Customer name matches request.name
                        expect(publishedMessage.customerName).toBe(request.name);
                        // createdAt is ISO 8601 UTC format
                        expect(publishedMessage.createdAt).toBeDefined();
                        const parsedDate = new Date(publishedMessage.createdAt);
                        expect(parsedDate.toISOString()).toBe(publishedMessage.createdAt);

                        return true;
                    }
                ),
                { numRuns: 200 }
            );
        });
    });

    // --- Property 12: No SQS publish on persistence failure ---
    /**
     * Property 12: No SQS publish on persistence failure
     *
     * When saveCustomerAndAccount throws an error, confirmationQueue.publish must NOT be called.
     *
     * **Validates: Requirements 10.6**
     */
    describe('Property 12: No SQS publish on persistence failure', () => {
        it('should NOT call confirmationQueue.publish when saveCustomerAndAccount throws', async () => {
            await fc.assert(
                fc.asyncProperty(
                    validRequest(),
                    fc.string({ minLength: 1, maxLength: 50 }),
                    async (request, errorMessage) => {
                        mockCustomerRepository.existsByIdentificationNumber.mockResolvedValue(false);
                        mockAccountNumberGenerator.generate.mockResolvedValue('1111111111');
                        mockCustomerAccountRepository.saveCustomerAndAccount.mockRejectedValue(
                            new Error(errorMessage)
                        );
                        mockConfirmationQueue.publish.mockResolvedValue(undefined);

                        try {
                            await useCase.execute(request);
                            // If it doesn't throw, that's unexpected — but check publish wasn't called
                        } catch {
                            // Expected: persistence failure propagates
                        }

                        // Publish must NOT have been called
                        expect(mockConfirmationQueue.publish).not.toHaveBeenCalled();

                        return true;
                    }
                ),
                { numRuns: 200 }
            );
        });
    });

    // --- Branch Coverage: confirmationQueue.publish() failure is gracefully handled ---
    /**
     * Covers the catch branch in the use case where confirmationQueue.publish() throws.
     * The use case must:
     * - Complete successfully (no exception propagated)
     * - Return the expected response (accountNumber, status, balance)
     * - Have already called saveCustomerAndAccount before the publish failure
     *
     * **Validates: Requirements 10.2 (graceful degradation on SQS failure)**
     */
    describe('Branch: confirmationQueue.publish() throws', () => {
        it('should complete successfully and return expected response when publish fails', async () => {
            await fc.assert(
                fc.asyncProperty(
                    validRequest(),
                    fc.string({ minLength: 1, maxLength: 100 }),
                    async (request, errorMessage) => {
                        jest.clearAllMocks();
                        mockCustomerRepository.existsByIdentificationNumber.mockResolvedValue(false);
                        mockAccountNumberGenerator.generate.mockResolvedValue('7777777777');
                        mockCustomerAccountRepository.saveCustomerAndAccount.mockResolvedValue(undefined);
                        mockConfirmationQueue.publish.mockRejectedValue(new Error(errorMessage));

                        // execute() must NOT throw
                        const response = await useCase.execute(request);

                        // Response must be correct despite publish failure
                        expect(response.accountNumber).toBe('7777777777');
                        expect(response.status).toBe('ACTIVE');
                        expect(response.balance).toBe(request.initialAmount);

                        // saveCustomerAndAccount must have been called (persistence succeeded before publish)
                        expect(mockCustomerAccountRepository.saveCustomerAndAccount).toHaveBeenCalledTimes(1);

                        // publish was attempted
                        expect(mockConfirmationQueue.publish).toHaveBeenCalledTimes(1);

                        return true;
                    }
                ),
                { numRuns: 200 }
            );
        });
    });

    // --- Branch Coverage: accountNumberGenerator.generate() throws ---
    /**
     * Covers the branch where account number generation fails (e.g., uniqueness exhaustion).
     * The use case must:
     * - Propagate the exception
     * - NOT call saveCustomerAndAccount
     * - NOT call confirmationQueue.publish
     *
     * **Validates: Requirements 8.4 (generation failure → internal error)**
     */
    describe('Branch: accountNumberGenerator.generate() throws', () => {
        it('should propagate the error and not persist or publish', async () => {
            await fc.assert(
                fc.asyncProperty(
                    validRequest(),
                    fc.string({ minLength: 1, maxLength: 100 }),
                    async (request, errorMessage) => {
                        jest.clearAllMocks();
                        mockCustomerRepository.existsByIdentificationNumber.mockResolvedValue(false);
                        mockAccountNumberGenerator.generate.mockRejectedValue(new Error(errorMessage));

                        let thrownError: unknown = null;

                        try {
                            await useCase.execute(request);
                        } catch (error) {
                            thrownError = error;
                        }

                        // Exception must propagate
                        expect(thrownError).toBeInstanceOf(Error);
                        expect((thrownError as Error).message).toBe(errorMessage);

                        // No persistence must have occurred
                        expect(mockCustomerAccountRepository.saveCustomerAndAccount).not.toHaveBeenCalled();

                        // No publish must have occurred
                        expect(mockConfirmationQueue.publish).not.toHaveBeenCalled();

                        return true;
                    }
                ),
                { numRuns: 200 }
            );
        });
    });

    // --- Branch Coverage: customerRepository.existsByIdentificationNumber() throws ---
    /**
     * Covers the branch where the duplicate check itself fails (e.g., DynamoDB timeout).
     * The use case must:
     * - Propagate the exception
     * - NOT call accountNumberGenerator.generate()
     * - NOT call saveCustomerAndAccount
     * - NOT call confirmationQueue.publish
     *
     * **Validates: Requirements 9.1 (unexpected error propagation)**
     */
    describe('Branch: customerRepository.existsByIdentificationNumber() throws', () => {
        it('should propagate the error without generating account number, persisting, or publishing', async () => {
            await fc.assert(
                fc.asyncProperty(
                    validRequest(),
                    fc.string({ minLength: 1, maxLength: 100 }),
                    async (request, errorMessage) => {
                        jest.clearAllMocks();
                        mockCustomerRepository.existsByIdentificationNumber.mockRejectedValue(
                            new Error(errorMessage)
                        );

                        let thrownError: unknown = null;

                        try {
                            await useCase.execute(request);
                        } catch (error) {
                            thrownError = error;
                        }

                        // Exception must propagate
                        expect(thrownError).toBeInstanceOf(Error);
                        expect((thrownError as Error).message).toBe(errorMessage);

                        // No account number generation
                        expect(mockAccountNumberGenerator.generate).not.toHaveBeenCalled();

                        // No persistence
                        expect(mockCustomerAccountRepository.saveCustomerAndAccount).not.toHaveBeenCalled();

                        // No publish
                        expect(mockConfirmationQueue.publish).not.toHaveBeenCalled();

                        return true;
                    }
                ),
                { numRuns: 200 }
            );
        });
    });

    // --- Branch Coverage: confirmationQueue.publish() throws a non-Error value ---
    /**
     * Covers the else branch in the catch block: `error instanceof Error ? error.message : String(error)`
     * When publish rejects with a value that is NOT an instance of Error (e.g., a string, number, null, undefined),
     * the use case must:
     * - Complete successfully (no exception propagated)
     * - Return the expected response
     * - Log the thrown value converted via String() in console.warn
     *
     * **Validates: Requirements 10.2 (graceful degradation), branch coverage for String(error) path**
     */
    describe('Branch: confirmationQueue.publish() throws a non-Error value', () => {
        it('should complete successfully and log the non-Error value via String() in console.warn', async () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

            await fc.assert(
                fc.asyncProperty(
                    validRequest(),
                    fc.oneof(
                        fc.string({ minLength: 1, maxLength: 50 }),
                        fc.integer(),
                        fc.constant(null),
                        fc.constant(undefined),
                        fc.boolean()
                    ),
                    async (request, nonErrorValue) => {
                        jest.clearAllMocks();
                        warnSpy.mockClear();

                        mockCustomerRepository.existsByIdentificationNumber.mockResolvedValue(false);
                        mockAccountNumberGenerator.generate.mockResolvedValue('8888888888');
                        mockCustomerAccountRepository.saveCustomerAndAccount.mockResolvedValue(undefined);
                        mockConfirmationQueue.publish.mockRejectedValue(nonErrorValue);

                        // execute() must NOT throw
                        const response = await useCase.execute(request);

                        // Response must be correct
                        expect(response.accountNumber).toBe('8888888888');
                        expect(response.status).toBe('ACTIVE');
                        expect(response.balance).toBe(request.initialAmount);

                        // console.warn must have been called with the String()-converted value
                        expect(warnSpy).toHaveBeenCalledTimes(1);
                        const loggedMessage = warnSpy.mock.calls[0]![0] as string;
                        const parsed = JSON.parse(loggedMessage);

                        expect(parsed.error).toBe(String(nonErrorValue));
                        expect(parsed.level).toBe('warn');
                        expect(parsed.message).toBe('Failed to publish confirmation message');
                        expect(parsed.requestId).toBe(request.requestId);
                        expect(parsed.accountNumber).toBe('8888888888');

                        return true;
                    }
                ),
                { numRuns: 200 }
            );

            warnSpy.mockRestore();
        });
    });
});
