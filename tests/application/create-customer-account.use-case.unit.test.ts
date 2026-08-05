import { CreateCustomerAccountUseCase, ICreateCustomerAccountRequest } from '@/application/create-customer-account.use-case';
import { ICustomerRepository } from '@/domain/ports/customer-repository';
import { ICustomerAccountRepository } from '@/domain/ports/customer-account-repository';
import { IAccountNumberGenerator } from '@/domain/ports/account-number-generator';
import { IConfirmationQueue } from '@/domain/ports/confirmation-queue';
import { ValidationError } from '@/domain/exceptions/validation.error';
import { ErrorCodes } from '@/domain/constants/error-codes';

/**
 * Unit tests for CreateCustomerAccountUseCase orchestration and adapters.
 *
 * **Validates: Requirements 4.2, 8.4, 10.2, 6.3, 5.2**
 */
describe('CreateCustomerAccountUseCase - Unit Tests', () => {
    let mockCustomerRepository: jest.Mocked<ICustomerRepository>;
    let mockCustomerAccountRepository: jest.Mocked<ICustomerAccountRepository>;
    let mockAccountNumberGenerator: jest.Mocked<IAccountNumberGenerator>;
    let mockConfirmationQueue: jest.Mocked<IConfirmationQueue>;
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
        } as jest.Mocked<IConfirmationQueue>;

        useCase = new CreateCustomerAccountUseCase(
            mockCustomerRepository,
            mockCustomerAccountRepository,
            mockAccountNumberGenerator,
            mockConfirmationQueue
        );
    });

    function createValidRequest(overrides?: Partial<ICreateCustomerAccountRequest>): ICreateCustomerAccountRequest {
        return {
            name: 'Jane Smith',
            dateOfBirth: '1990-05-15',
            identificationNumber: 'ID12345',
            email: 'jane@example.com',
            initialAmount: 500,
            requestId: 'req-unit-test-001',
            ...overrides,
        };
    }

    // --- Test 1: Zero amount acceptance (Requirement 4.2) ---
    describe('Zero amount acceptance', () => {
        it('should accept initialAmount = 0 and return balance: 0', async () => {
            mockCustomerRepository.existsByIdentificationNumber.mockResolvedValue(false);
            mockAccountNumberGenerator.generate.mockResolvedValue('1234567890');
            mockCustomerAccountRepository.saveCustomerAndAccount.mockResolvedValue(undefined);
            mockConfirmationQueue.publish.mockResolvedValue(undefined);

            const request = createValidRequest({ initialAmount: 0 });

            const response = await useCase.execute(request);

            expect(response.balance).toBe(0);
            expect(response.accountNumber).toBe('1234567890');
            expect(response.status).toBe('ACTIVE');
        });
    });

    // --- Test 2: SQS publish failure → log warning, still return success (Requirement 10.2) ---
    describe('SQS publish failure → log warning, still return success', () => {
        let consoleWarnSpy: jest.SpyInstance;

        beforeEach(() => {
            consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        });

        afterEach(() => {
            consoleWarnSpy.mockRestore();
        });

        it('should complete successfully when confirmationQueue.publish() throws', async () => {
            mockCustomerRepository.existsByIdentificationNumber.mockResolvedValue(false);
            mockAccountNumberGenerator.generate.mockResolvedValue('9876543210');
            mockCustomerAccountRepository.saveCustomerAndAccount.mockResolvedValue(undefined);
            mockConfirmationQueue.publish.mockRejectedValue(new Error('SQS connection timeout'));

            const request = createValidRequest({ requestId: 'req-sqs-fail-001' });

            const response = await useCase.execute(request);

            // Use case still returns success
            expect(response.accountNumber).toBe('9876543210');
            expect(response.status).toBe('ACTIVE');
            expect(response.balance).toBe(500);
        });

        it('should log a structured warning with requestId, accountNumber, and error message', async () => {
            mockCustomerRepository.existsByIdentificationNumber.mockResolvedValue(false);
            mockAccountNumberGenerator.generate.mockResolvedValue('5555555555');
            mockCustomerAccountRepository.saveCustomerAndAccount.mockResolvedValue(undefined);
            mockConfirmationQueue.publish.mockRejectedValue(new Error('SQS service unavailable'));

            const request = createValidRequest({ requestId: 'req-sqs-warn-002' });

            await useCase.execute(request);

            expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
            const loggedJson = JSON.parse(consoleWarnSpy.mock.calls[0][0]);
            expect(loggedJson.level).toBe('warn');
            expect(loggedJson.requestId).toBe('req-sqs-warn-002');
            expect(loggedJson.accountNumber).toBe('5555555555');
            expect(loggedJson.error).toBe('SQS service unavailable');
        });
    });

    // --- Test 3: Email validation ordering (Requirement 6.3) ---
    describe('Email validation ordering', () => {
        it('should throw MISSING_REQUIRED_FIELD for empty email, not INVALID_EMAIL_FORMAT', async () => {
            const request = createValidRequest({ email: '' });

            let thrownError: unknown = null;

            try {
                await useCase.execute(request);
            } catch (error) {
                thrownError = error;
            }

            expect(thrownError).toBeInstanceOf(ValidationError);
            const validationError = thrownError as ValidationError;
            expect(validationError.code).toBe(ErrorCodes.MISSING_REQUIRED_FIELD);
            expect(validationError.fields).toContain('email');
        });

        it('should throw MISSING_REQUIRED_FIELD for null email, not INVALID_EMAIL_FORMAT', async () => {
            const request = createValidRequest({ email: null as unknown as string });

            let thrownError: unknown = null;

            try {
                await useCase.execute(request);
            } catch (error) {
                thrownError = error;
            }

            expect(thrownError).toBeInstanceOf(ValidationError);
            const validationError = thrownError as ValidationError;
            expect(validationError.code).toBe(ErrorCodes.MISSING_REQUIRED_FIELD);
            expect(validationError.fields).toContain('email');
        });
    });

    // --- Test 4: Duplicate check called before persistence (Requirement 5.2) ---
    describe('Duplicate check called before persistence', () => {
        it('should call existsByIdentificationNumber BEFORE saveCustomerAndAccount', async () => {
            const callOrder: string[] = [];

            mockCustomerRepository.existsByIdentificationNumber.mockImplementation(async () => {
                callOrder.push('existsByIdentificationNumber');
                return false;
            });

            mockCustomerAccountRepository.saveCustomerAndAccount.mockImplementation(async () => {
                callOrder.push('saveCustomerAndAccount');
                return undefined;
            });

            mockAccountNumberGenerator.generate.mockResolvedValue('1111111111');
            mockConfirmationQueue.publish.mockResolvedValue(undefined);

            const request = createValidRequest();

            await useCase.execute(request);

            const duplicateCheckIndex = callOrder.indexOf('existsByIdentificationNumber');
            const persistenceIndex = callOrder.indexOf('saveCustomerAndAccount');

            expect(duplicateCheckIndex).toBeGreaterThanOrEqual(0);
            expect(persistenceIndex).toBeGreaterThanOrEqual(0);
            expect(duplicateCheckIndex).toBeLessThan(persistenceIndex);
        });
    });
});
