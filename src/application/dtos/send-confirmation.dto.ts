/**
 * Request DTO for sending a confirmation email to a customer.
 */
export interface ISendConfirmationRequest {
    email: string;
    accountNumber: string;
    customerName: string;
    createdAt: string;
}
