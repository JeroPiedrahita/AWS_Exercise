import { DynamoDBClient, GetItemCommand, PutItemCommand, ScanCommand } from "@aws-sdk/client-dynamodb";
import { Transaction } from "../../domain/entities/transaction";
import { ITransactionRepository } from "../../domain/ports/transaction-repository";
import { TransactionStatusType } from "../../domain/constants/transaction-status";
/**
 * DynamoDB implementation of the transaction repository.
 * 
 * Responsible for persisting and retrieving
 * transaction information from Amazon DynamoDB.
 */
export class DynamonDBTransactionAdapter implements ITransactionRepository {

    private readonly client = new DynamoDBClient({
        region: "us-east-1"
    });
    /**
     * Persists a transaction in DynamoDB
     * @param transaction Transaction to be stored.
     * 
     * @returns A promise that resolves when the transaction has been
     * successfully saved.
     */

    async save(transaction: Transaction): Promise<void> {

        await this.client.send(
            new PutItemCommand({
                TableName: "TransaccionesBancariasDev",
                Item: {
                    id: {
                        S: transaction.id
                    },
                    accountId: {
                        S: transaction.accountId
                    },
                    amount: {
                        N: transaction.amount.toString()
                    },
                    status: {
                        S: transaction.status
                    },
                    createdAt: {
                        S: transaction.createdAt.toISOString()
                    }
                }
            })
        );

        console.log(
            "[INFRASTRUCTURE] Transacción guardada en DynamoDB:",
            transaction.id
        );
    }
    /**
     * Converts a DynamoDB item into a Transaction entity
     * @param item DynamoDB item representation.
     * @returns A transaction domain entity
     */

    private mapToTransaction(item: any): Transaction{

        return new Transaction(
            item.id.S!,
            item.accountId.S!,
            Number(item.amount.N!),
            item.status.S! as TransactionStatusType,
            new Date(item.createdAt.S!),
        );
        
    }
    /**
     * Retrieves a transaction by its identifier.
     * @param id Unique transaction identifier.
     * 
     * @returns The matching transaction or null if 
     * no transaction exists 
     */

    async getById(id: string): Promise<Transaction | null> {
        const response = await this.client.send(
            new GetItemCommand({
                TableName: "TransaccionesBancariasDev",
                Key: {
                    id:{
                        S: id
                    },
                }
            })
        );

        if (!response.Item) {
            return null;
        }
        const item = response.Item;
        if (
            !item.id ||
            !item.accountId ||
            !item.amount ||
            !item.status ||
            !item.createdAt
        ) {
            return null;
        }
        return this.mapToTransaction(item);
    }

    /**
     * Retrieves all transactions created between
     * the provided dates.
     * @param startDate Start date of the search range
     * @param endDate End date of the search range.
     * @returns A list of matching transactions.
     */
    async getTransactionsBetweenDates(startDate: Date, endDate: Date
    ): Promise<Transaction[]> {
        const response = await this.client.send(
            new ScanCommand({
                TableName: "TransaccionesBancariasDev",
                FilterExpression:
                    "createdAt >= :startDate AND createdAt <= :endDate",
                ExpressionAttributeValues: {
                    ":startDate": {
                        S: startDate.toISOString()
                    },

                    ":endDate":{
                        S: endDate.toISOString()
                    }
                }

            })
        );

        if (!response.Items){
            return[];
        }
        return response.Items.map(
            item => this.mapToTransaction(item)
        );
    }

}