import { z } from 'zod';
import { TransactionStatus } from '../../../domain/constants/transaction-status';
import { AccountRules } from '../../../domain/constants/account.constants';
import { SchemaLimits } from '../../constants/schema.constants';

export const idSchema = z.string().min(1).max(SchemaLimits.MAX_UUID_LENGTH);

export const accountIdSchema = z.string().min(1).max(SchemaLimits.MAX_UUID_LENGTH);

export const amountSchema = z.number().gt(0).lte(AccountRules.MAX_INITIAL_AMOUNT);

export const transactionStatusSchema = z.enum(TransactionStatus);
