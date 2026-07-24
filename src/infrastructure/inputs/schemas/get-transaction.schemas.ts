import { z } from 'zod';
import { transactionStatusSchema } from './shared.schemas';

export const GetTransactionPathParamsSchema = z.object({
    id: z.string().trim().min(1).max(128),
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
