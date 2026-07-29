import { z } from 'zod';
import { transactionStatusSchema } from './shared.schemas';
import { SchemaLimits } from '../../constants/schema.constants';

export const GetTransactionPathParamsSchema = z.object({
    id: z.string().trim().min(1).max(SchemaLimits.MAX_TRANSACTION_ID_LENGTH),
});

export type GetTransactionPathParams = z.infer<typeof GetTransactionPathParamsSchema>;

export const TransactionResponseSchema = z.object({
    id: z.string().min(1),
    accountId: z.string().min(1),
    amount: z.number().positive(),
    status: transactionStatusSchema,
    createdAt: z.string().datetime(),
});

export type TransactionResponse = z.infer<typeof TransactionResponseSchema>;
