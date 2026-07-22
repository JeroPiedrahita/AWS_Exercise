import { z } from 'zod';
import { idSchema, accountIdSchema, amountSchema } from './shared.schemas';

export const RegisterPaymentRequestSchema = z.object({
    id: idSchema,
    accountId: accountIdSchema,
    amount: amountSchema,
}).strict();

export type RegisterPaymentRequest = z.infer<typeof RegisterPaymentRequestSchema>;
