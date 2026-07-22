import { z } from 'zod';
import { TransactionStatus } from '../../../domain/constants/transaction-status';

export const idSchema = z.string().min(1).max(36);

export const accountIdSchema = z.string().min(1).max(36);

export const amountSchema = z.number().gt(0).lte(999_999_999.99);

export const transactionStatusSchema = z.enum(TransactionStatus);
