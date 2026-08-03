import { ICustomerRepository } from '../domain/ports/customer-repository';
import { IEmailService } from './ports/email-service';

/**
 * Request DTO for sending a confirmation email to a customer.
 */
export interface ISendConfirmationRequest {
    email: string;
    accountNumber: string;
    customerName: string;
    createdAt: string;
}

/**
 * Use case that orchestrates sending a confirmation email to a customer
 * after account creation. Implements idempotency to prevent duplicate emails
 * on message redelivery.
 */
export class SendConfirmationUseCase {
    constructor(
        private readonly customerRepository: ICustomerRepository,
        private readonly emailService: IEmailService
    ) {}

    /**
     * Executes the confirmation email sending flow with idempotency guarantees.
     * @param request - The confirmation request data containing customer details.
     * @returns A promise that resolves when the operation completes (email sent or skipped).
     */
    async execute(request: ISendConfirmationRequest): Promise<void> {
        const confirmationSentAt = await this.customerRepository.getConfirmationStatus(request.accountNumber);

        if (confirmationSentAt) {
            return;
        }

        await this.emailService.sendConfirmationEmail(
            request.email,
            request.accountNumber,
            request.customerName,
            request.createdAt
        );

        const sentAt = new Date().toISOString();
        await this.customerRepository.markConfirmationSent(request.accountNumber, sentAt);
    }
}
