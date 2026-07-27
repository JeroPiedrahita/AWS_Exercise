import { Customer } from "../entities/customer";
import { Account } from "../entities/account";

/**
 * Defines the operations available for
 * atomically persisting customer and account records together.
 */
export interface ICustomerAccountRepository {
    /**
     * Atomically saves a customer and its associated account.
     * @param customer The customer entity to persist.
     * @param account The account entity to persist.
     */
    saveCustomerAndAccount(customer: Customer, account: Account): Promise<void>;
}
