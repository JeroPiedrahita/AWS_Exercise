import { AttributeValue, DynamoDBClient, TransactWriteItemsCommand, TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import { ICustomerAccountRepository } from "../../domain/ports/customer-account-repository";
import { Customer } from "../../domain/entities/customer";
import { Account } from "../../domain/entities/account";
import { ConflictError } from "../../domain/exceptions/conflict.error";
import { ErrorCodes } from "../../domain/constants/error-codes";

/**
 * DynamoDB implementation of the customer-account repository port.
 *
 * Responsible exclusively for atomic Customer + Account persistence
 * using DynamoDB TransactWriteItems. Applies a condition expression
 * on the Customer put to prevent concurrent duplicate creation based
 * on the normalizedIdentificationNumber attribute.
 */
export class DynamoDBTransactionAdapter implements ICustomerAccountRepository {

    private readonly customersTableName: string;
    private readonly accountsTableName: string;

    /**
     * Creates a new DynamoDBTransactionAdapter instance.
     * @param client The DynamoDB client used for all database operations.
     */
    constructor(private readonly client: DynamoDBClient) {
        this.customersTableName = process.env.CUSTOMERS_TABLE || 'CustomersTable';
        this.accountsTableName = process.env.ACCOUNTS_TABLE || 'AccountsTable';
    }

    /**
     * Atomically saves a customer and its associated account using a DynamoDB transaction.
     * The customer put includes a condition expression to prevent duplicates by
     * normalizedIdentificationNumber.
     * @param customer The customer entity to persist.
     * @param account The account entity to persist.
     * @throws ConflictError if a customer with the same normalizedIdentificationNumber already exists.
     */
    async saveCustomerAndAccount(customer: Customer, account: Account): Promise<void> {
        const customerItem: Record<string, AttributeValue> = {
            customerId: { S: customer.customerId },
            name: { S: customer.name },
            dateOfBirth: { S: customer.dateOfBirth },
            identificationNumber: { S: customer.identificationNumber },
            normalizedIdentificationNumber: { S: customer.normalizedIdentificationNumber },
            email: { S: customer.email },
            createdAt: { S: customer.createdAt },
            requestId: { S: customer.requestId },
            createdBy: { S: customer.createdBy },
        };

        if (customer.confirmationSentAt) {
            customerItem['confirmationSentAt'] = { S: customer.confirmationSentAt };
        }

        const accountItem: Record<string, AttributeValue> = {
            accountId: { S: account.accountId },
            customerId: { S: account.customerId },
            accountNumber: { S: account.accountNumber },
            balance: { N: account.balance.toString() },
            status: { S: account.status },
            createdAt: { S: account.createdAt },
            requestId: { S: account.requestId },
            createdBy: { S: account.createdBy },
        };

        try {
            await this.client.send(
                new TransactWriteItemsCommand({
                    TransactItems: [
                        {
                            Put: {
                                TableName: this.customersTableName,
                                Item: customerItem,
                                ConditionExpression: 'attribute_not_exists(normalizedIdentificationNumber)',
                            },
                        },
                        {
                            Put: {
                                TableName: this.accountsTableName,
                                Item: accountItem,
                            },
                        },
                    ],
                })
            );
        } catch (error: unknown) {
            if (error instanceof TransactionCanceledException) {
                const hasConditionCheckFailure = error.CancellationReasons?.some(
                    (reason) => reason.Code === 'ConditionalCheckFailed'
                );

                if (hasConditionCheckFailure) {
                    throw new ConflictError(
                        ErrorCodes.ACCOUNT_ALREADY_EXISTS,
                        `Customer with normalizedIdentificationNumber "${customer.normalizedIdentificationNumber}" already exists`,
                        'A customer with this identification number already exists'
                    );
                }
            }

            throw error;
        }
    }
}
