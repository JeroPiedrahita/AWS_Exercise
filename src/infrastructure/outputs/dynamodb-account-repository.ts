import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { IAccountRepository } from "../../domain/ports/account-repository";

/**
 * DynamoDB implementation of the account repository port.
 *
 * Responsible for querying account records in DynamoDB.
 * Uses the AccountsTable GSI (AccountNumberIndex) for account number uniqueness checks.
 */
export class DynamoDBAccountRepository implements IAccountRepository {

    private readonly tableName: string;

    /**
     * Creates a new DynamoDBAccountRepository instance.
     * @param client The DynamoDB client used for all database operations.
     */
    constructor(private readonly client: DynamoDBClient) {
        this.tableName = process.env.ACCOUNTS_TABLE || 'AccountsTable';
    }

    /**
     * Checks if an account with the given account number already exists.
     * Uses the AccountNumberIndex GSI for efficient lookup.
     * @param accountNumber The 10-digit account number to check.
     * @returns True if an account with that number exists.
     */
    async existsByAccountNumber(accountNumber: string): Promise<boolean> {
        const response = await this.client.send(
            new QueryCommand({
                TableName: this.tableName,
                IndexName: 'AccountNumberIndex',
                KeyConditionExpression: 'accountNumber = :accountNumber',
                ExpressionAttributeValues: {
                    ':accountNumber': { S: accountNumber },
                },
                Limit: 1,
            })
        );

        return (response.Items !== undefined && response.Items.length > 0);
    }
}
