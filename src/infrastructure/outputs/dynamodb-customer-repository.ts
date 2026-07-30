import { DynamoDBClient, QueryCommand, GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { ICustomerRepository } from "../../domain/ports/customer-repository";

/**
 * DynamoDB implementation of the customer repository port.
 *
 * Responsible for querying and updating customer records in DynamoDB.
 * Uses the CustomersTable GSI (IdentificationNumberIndex) for duplicate detection,
 * and the AccountsTable GSI (AccountNumberIndex) to resolve accountNumber → customerId
 * for confirmation status operations.
 */
export class DynamoDBCustomerRepository implements ICustomerRepository {

    private readonly customersTableName: string;
    private readonly accountsTableName: string;

    /**
     * Creates a new DynamoDBCustomerRepository instance.
     * @param client The DynamoDB client used for all database operations.
     */
    constructor(private readonly client: DynamoDBClient) {
        this.customersTableName = process.env.CUSTOMERS_TABLE || 'CustomersTable';
        this.accountsTableName = process.env.ACCOUNTS_TABLE || 'AccountsTable';
    }

    /**
     * Checks if a customer with the given normalized identification number already exists.
     * Uses the IdentificationNumberIndex GSI for efficient lookup.
     * @param normalizedId Lowercase, trimmed identification number.
     * @returns True if a customer with that identification number exists.
     */
    async existsByIdentificationNumber(normalizedId: string): Promise<boolean> {
        const response = await this.client.send(
            new QueryCommand({
                TableName: this.customersTableName,
                IndexName: 'IdentificationNumberIndex',
                KeyConditionExpression: 'normalizedIdentificationNumber = :normalizedId',
                ExpressionAttributeValues: {
                    ':normalizedId': { S: normalizedId },
                },
                Limit: 1,
            })
        );

        return (response.Items !== undefined && response.Items.length > 0);
    }

    /**
     * Retrieves the confirmation status for a customer associated with the given account number.
     * First queries the AccountsTable by AccountNumberIndex GSI to find the customerId,
     * then retrieves the confirmationSentAt attribute from the CustomersTable.
     * @param accountNumber The account number to look up.
     * @returns The ISO 8601 UTC timestamp when confirmation was sent, or null if not yet sent.
     */
    async getConfirmationStatus(accountNumber: string): Promise<string | null> {
        const customerId = await this.resolveCustomerId(accountNumber);
        if (!customerId) {
            return null;
        }

        const response = await this.client.send(
            new GetItemCommand({
                TableName: this.customersTableName,
                Key: {
                    customerId: { S: customerId },
                },
                ProjectionExpression: 'confirmationSentAt',
            })
        );

        if (!response.Item) {
            return null;
        }

        const confirmationSentAt = response.Item['confirmationSentAt'];
        if (!confirmationSentAt || !confirmationSentAt.S) {
            return null;
        }

        return confirmationSentAt.S;
    }

    /**
     * Marks the confirmation email as sent for the customer associated with the given account number.
     * First resolves the customerId from the AccountsTable, then updates the confirmationSentAt
     * attribute on the CustomersTable.
     * @param accountNumber The account number to update.
     * @param sentAt ISO 8601 UTC timestamp when the confirmation was sent.
     */
    async markConfirmationSent(accountNumber: string, sentAt: string): Promise<void> {
        const customerId = await this.resolveCustomerId(accountNumber);
        if (!customerId) {
            throw new Error(`No account found for accountNumber: ${accountNumber}`);
        }

        await this.client.send(
            new UpdateItemCommand({
                TableName: this.customersTableName,
                Key: {
                    customerId: { S: customerId },
                },
                UpdateExpression: 'SET confirmationSentAt = :sentAt',
                ExpressionAttributeValues: {
                    ':sentAt': { S: sentAt },
                },
            })
        );
    }

    /**
     * Resolves the customerId for a given accountNumber by querying the
     * AccountsTable AccountNumberIndex GSI.
     * @param accountNumber The account number to look up.
     * @returns The customerId associated with the account, or null if not found.
     */
    private async resolveCustomerId(accountNumber: string): Promise<string | null> {
        const response = await this.client.send(
            new QueryCommand({
                TableName: this.accountsTableName,
                IndexName: 'AccountNumberIndex',
                KeyConditionExpression: 'accountNumber = :accountNumber',
                ExpressionAttributeValues: {
                    ':accountNumber': { S: accountNumber },
                },
                Limit: 1,
            })
        );

        if (!response.Items || response.Items.length === 0) {
            return null;
        }

        const item = response.Items[0];
        if (!item || !item['customerId'] || !item['customerId'].S) {
            return null;
        }

        return item['customerId'].S;
    }
}
