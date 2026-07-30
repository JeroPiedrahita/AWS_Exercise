

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