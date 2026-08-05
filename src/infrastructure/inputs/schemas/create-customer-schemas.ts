import { z } from 'zod';

export const CreateCustomerRequestSchema = z.object({
    name: z.string().min(1),
    dateOfBirth: z.string().min(1),
    identificationNumber: z.string().min(1),
    email: z.string().min(1),
    initialAmount: z.number(),
}).strict();

export type CreateCustomerRequest = z.infer<typeof CreateCustomerRequestSchema>;
