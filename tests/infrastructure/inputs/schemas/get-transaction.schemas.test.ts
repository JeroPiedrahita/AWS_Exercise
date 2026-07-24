import {
    GetTransactionPathParamsSchema,
    TransactionResponseSchema,
} from '@/infrastructure/inputs/schemas/get-transaction.schemas';

describe('GetTransactionPathParamsSchema', () => {
    describe('valid inputs', () => {
        it('should accept a valid id', () => {
            const result = GetTransactionPathParamsSchema.safeParse({ id: 'txn-001' });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.id).toBe('txn-001');
            }
        });

        it('should accept id at max length of 128 characters', () => {
            const result = GetTransactionPathParamsSchema.safeParse({ id: 'x'.repeat(128) });

            expect(result.success).toBe(true);
        });
    });

    describe('trimming behavior', () => {
        it('should trim leading whitespace from id', () => {
            const result = GetTransactionPathParamsSchema.safeParse({ id: '   txn-001' });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.id).toBe('txn-001');
            }
        });

        it('should trim trailing whitespace from id', () => {
            const result = GetTransactionPathParamsSchema.safeParse({ id: 'txn-001   ' });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.id).toBe('txn-001');
            }
        });

        it('should trim both leading and trailing whitespace from id', () => {
            const result = GetTransactionPathParamsSchema.safeParse({ id: '  txn-001  ' });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.id).toBe('txn-001');
            }
        });

        it('should reject id that is only whitespace (empty after trim)', () => {
            const result = GetTransactionPathParamsSchema.safeParse({ id: '   ' });

            expect(result.success).toBe(false);
        });
    });

    describe('invalid inputs', () => {
        it('should reject empty id', () => {
            const result = GetTransactionPathParamsSchema.safeParse({ id: '' });

            expect(result.success).toBe(false);
        });

        it('should reject id exceeding 128 characters', () => {
            const result = GetTransactionPathParamsSchema.safeParse({ id: 'x'.repeat(129) });

            expect(result.success).toBe(false);
        });
    });
});

describe('TransactionResponseSchema', () => {
    const validResponse = {
        id: 'txn-001',
        accountId: 'acc-001',
        amount: 150.00,
        status: 'COMPLETED',
        createdAt: '2024-01-15T10:30:00Z',
    };

    describe('valid inputs', () => {
        it('should accept a valid transaction response', () => {
            const result = TransactionResponseSchema.safeParse(validResponse);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toEqual(validResponse);
            }
        });

        it('should accept status PENDING', () => {
            const result = TransactionResponseSchema.safeParse({ ...validResponse, status: 'PENDING' });

            expect(result.success).toBe(true);
        });

        it('should accept status COMPLETED', () => {
            const result = TransactionResponseSchema.safeParse({ ...validResponse, status: 'COMPLETED' });

            expect(result.success).toBe(true);
        });

        it('should accept status FAILED', () => {
            const result = TransactionResponseSchema.safeParse({ ...validResponse, status: 'FAILED' });

            expect(result.success).toBe(true);
        });
    });

    describe('missing fields', () => {
        it('should reject when id is missing', () => {
            const { id, ...input } = validResponse;

            const result = TransactionResponseSchema.safeParse(input);

            expect(result.success).toBe(false);
        });

        it('should reject when accountId is missing', () => {
            const { accountId, ...input } = validResponse;

            const result = TransactionResponseSchema.safeParse(input);

            expect(result.success).toBe(false);
        });

        it('should reject when amount is missing', () => {
            const { amount, ...input } = validResponse;

            const result = TransactionResponseSchema.safeParse(input);

            expect(result.success).toBe(false);
        });

        it('should reject when status is missing', () => {
            const { status, ...input } = validResponse;

            const result = TransactionResponseSchema.safeParse(input);

            expect(result.success).toBe(false);
        });

        it('should reject when createdAt is missing', () => {
            const { createdAt, ...input } = validResponse;

            const result = TransactionResponseSchema.safeParse(input);

            expect(result.success).toBe(false);
        });
    });

    describe('invalid field values', () => {
        it('should reject invalid status value', () => {
            const result = TransactionResponseSchema.safeParse({ ...validResponse, status: 'UNKNOWN' });

            expect(result.success).toBe(false);
        });

        it('should reject invalid datetime format for createdAt', () => {
            const result = TransactionResponseSchema.safeParse({ ...validResponse, createdAt: '2024-01-15' });

            expect(result.success).toBe(false);
        });

        it('should reject amount of 0 (must be positive)', () => {
            const result = TransactionResponseSchema.safeParse({ ...validResponse, amount: 0 });

            expect(result.success).toBe(false);
        });

        it('should reject negative amount', () => {
            const result = TransactionResponseSchema.safeParse({ ...validResponse, amount: -5 });

            expect(result.success).toBe(false);
        });
    });
});
