import {Transaction} from "../entities/transaction";
/**
 * Defines the operations available for
 * persisting and retrieving transactions.
 */
export interface ITransactionRepository {
    /**
     * Stores a transaction.
     * @param transaction Transaction to be persisted
     */
    save(transaction: Transaction): Promise<void>;
    /**
     * Retrieves a transaction by its identifier.
     * @param id Transaction identifier.
     * @returns The transaction if found, otherwise null.
     */
    getById(id: string): Promise<Transaction | null>;
    /**
     * Retrieves all transaction created between the provided dates.
     * @param startDate Start dates.
     * @param finishDate End dates.
     * 
     * @returns List of matching transactions.
     */
    getTransactionsBetweenDates(
        startDate: Date,
        finishDate: Date
    ): Promise<Transaction[]>

}

