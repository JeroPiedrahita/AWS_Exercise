import { TransactionStatus } from "../constants/transaction-status";
import { AccountRules } from "../constants/account.constants";
/**
 * Represents a financial transaction processed by the system.
 */
export class Transaction{
    /**
     * Creates a new transaction.
     * 
     * @param id Unique transaction identifier. 
     * @param accountId Account identifier.
     * @param amount Transaction amount.
     * @param status  Current transaction status.
     * @param createdAt Transaction creation date.
     */
    constructor(
        public readonly id: string,
        public readonly accountId: string,
        public readonly amount: number,
        public readonly status: keyof typeof TransactionStatus,
        public readonly createdAt: Date
    ){
        this.validateAmount();
    }
    //Bussines Ruls: The value of transaction is more that cero
    private validateAmount(): void{
        if(this.amount <=AccountRules.MIN_INITIAL_AMOUNT){
            throw new Error("El monto de la transacción debe ser mayor a cero.");
        }
    }
}