import {Transaction} from "../domain/entities/transaction";
import { ITransactionRepository} from "../domain/ports/transaction-repository" ;
import { TransactionStatus } from "../domain/constants/transaction-status";

export class ProcessPaymentUseCase {
/**
 * Creates a new instance of the use case
 * 
 * @param transactionRepository used to store transactions
 */
    constructor(private readonly transactionRepository: ITransactionRepository){}
    /**
     * Processes a new patment transaction
     * @param id Unique transaction identifier.
     * @param accountId Account identifier associated with the transaction.
     * @param amount  Transaction amount.
     * @returns A promise that resolves when the transaction has been stored.
     */

    async execute(id:string, accountId: string, amount: number): Promise<void>{
        const transaction = new Transaction(id, accountId, amount, TransactionStatus.COMPLETED, new Date());

        await this.transactionRepository.save(transaction);

    }
}