import { TransactionNotFoundError } from "../domain/exceptions/transaction-not-found.error";
import { ITransactionRepository} from "../domain/ports/transaction-repository" ;

interface GetTransactionRequest {
    id: string;
}
/**
 * Use case responsible for retrieving
 * a transaction by its identifier.
 */
export class GetTransactionUseCase{
    /**
     * Creates a new instance of the use case.
     * 
     * @param repository Repository used to retrieve transaction.
     */
    constructor(private readonly repository: ITransactionRepository){}
    /**
     * Retrieves a transaction by its identifier.
     * @param request Transaction query information.
     * @returns  The transaction if it exists.
     * @throws TransactionNotFoundError when the transaction cannot be found.
     */
    async execute(request:GetTransactionRequest){
        const transaction =
            await this.repository.getById(request.id);
        if (!transaction){
        throw new TransactionNotFoundError(
            "Transaction not found",
            "Verifica el id de la transacción"
        );
        }
        return transaction;
        
    }

}

