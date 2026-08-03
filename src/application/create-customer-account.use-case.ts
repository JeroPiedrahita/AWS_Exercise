import { ICustomerRepository } from '../domain/ports/customer-repository';
import { ICustomerAccountRepository } from '../domain/ports/customer-account-repository';
import { IAccountNumberGenerator } from '../domain/ports/account-number-generator';
import { IConfirmationPublisher } from '../domain/ports/confirmation-publisher';
import { Customer } from '../domain/entities/customer';
import { Account } from '../domain/entities/account';
import { AccountStatus } from '../domain/constants/account-status';
import { ErrorCodes } from '../domain/constants/error-codes';
import { ValidationError } from '../domain/exceptions/validation.error';
import { ConflictError } from '../domain/exceptions/conflict.error';
import { validateEmail } from '../domain/validators/email.validator';
import { validateAge } from '../domain/validators/age.validator';
import { validateAmount } from '../domain/validators/amount.validator';
import crypto from 'crypto';

/**
 * Request DTO for creating a customer account.
 */
export interface ICreateCustomerAccountRequest {
    name: string;
    dateOfBirth: string;
    identificationNumber: string;
    email: string;
    initialAmount: number;
    requestId: string;
}

/**
 * Response DTO returned after successful account creation.
 */
export interface ICreateCustomerAccountResponse {
    accountNumber: string;
    status: string;
    balance: number;
}

/**
 * Use case that orchestrates the creation of a new customer account.
 * Validates input, checks for duplicates, persists entities atomically,
 * and publishes a confirmation message.
 */
export class CreateCustomerAccountUseCase {
    constructor(
        private readonly customerRepository: ICustomerRepository,
        private readonly customerAccountRepository: ICustomerAccountRepository,
        private readonly accountNumberGenerator: IAccountNumberGenerator,
        private readonly confirmationQueue: IConfirmationPublisher
    ) {}

    /**
     * Executes the customer account creation flow.
     * @param request - The account creation request data.
     * @returns A promise resolving to the created account details.
     * @throws {ValidationError} If required fields are missing or input validation fails.
     * @throws {ConflictError} If a customer with the same identification number already exists.
     */
    async execute(request: ICreateCustomerAccountRequest): Promise<ICreateCustomerAccountResponse> {
        this.validateRequiredFields(request);

        validateEmail(request.email);
        validateAge(request.dateOfBirth, new Date());
        validateAmount(request.initialAmount);

        const normalizedIdentificationNumber = request.identificationNumber.trim().toLowerCase();

        const exists = await this.customerRepository.existsByIdentificationNumber(normalizedIdentificationNumber);
        if (exists) {
            throw new ConflictError(
                ErrorCodes.ACCOUNT_ALREADY_EXISTS,
                `Customer with identification number "${normalizedIdentificationNumber}" already exists`,
                'An account with this identification number already exists.'
            );
        }

        const accountNumber = await this.accountNumberGenerator.generate();

        const now = new Date().toISOString();
        const customerId = crypto.randomUUID();
        const accountId = crypto.randomUUID();
        const createdBy = 'customer-account-service';

        const customer: Customer = {
            customerId,
            name: request.name,
            dateOfBirth: request.dateOfBirth,
            identificationNumber: request.identificationNumber,
            normalizedIdentificationNumber,
            email: request.email,
            createdAt: now,
            requestId: request.requestId,
            createdBy,
        };

        const account: Account = {
            accountId,
            customerId,
            accountNumber,
            balance: request.initialAmount,
            status: AccountStatus.ACTIVE,
            createdAt: now,
            requestId: request.requestId,
            createdBy,
        };

        await this.customerAccountRepository.saveCustomerAndAccount(customer, account);

        try {
            await this.confirmationQueue.publish({
                email: request.email,
                accountNumber,
                customerName: request.name,
                createdAt: now,
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.warn(JSON.stringify({
                level: 'warn',
                message: 'Failed to publish confirmation message',
                requestId: request.requestId,
                accountNumber,
                error: errorMessage,
            }));
        }

        return {
            accountNumber,
            status: AccountStatus.ACTIVE,
            balance: request.initialAmount,
        };
    }

    /**
     * Validates that all required fields are present and non-empty.
     * Reports ALL missing fields in a single error.
     */
    private validateRequiredFields(request: ICreateCustomerAccountRequest): void {
        const missingFields: string[] = [];

        if (!request.name || request.name.trim().length === 0) {
            missingFields.push('name');
        }

        if (!request.dateOfBirth || request.dateOfBirth.trim().length === 0) {
            missingFields.push('dateOfBirth');
        }

        if (!request.identificationNumber || request.identificationNumber.trim().length === 0) {
            missingFields.push('identificationNumber');
        }

        if (!request.email || request.email.trim().length === 0) {
            missingFields.push('email');
        }

        if (request.initialAmount === null || request.initialAmount === undefined) {
            missingFields.push('initialAmount');
        }

        if (missingFields.length > 0) {
            throw new ValidationError(
                ErrorCodes.MISSING_REQUIRED_FIELD,
                missingFields,
                `Missing required fields: ${missingFields.join(', ')}`,
                'One or more required fields are missing.'
            );
        }
    }
}
