import { AccountStatusType } from '../constants/account-status';

/**
 * Represents a bank account linked to a customer.
 */
export interface Account {
    readonly accountId: string;
    readonly customerId: string;
    /** 10 numeric digits */
    readonly accountNumber: string;
    readonly balance: number;
    readonly status: AccountStatusType;
    /** ISO 8601 UTC timestamp */
    readonly createdAt: string;
    readonly requestId: string;
    readonly createdBy: string;
}
