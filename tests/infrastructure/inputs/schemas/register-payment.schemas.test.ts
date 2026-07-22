import { RegisterPaymentRequestSchema } from '@/infrastructure/inputs/schemas/register-payment.schemas';

describe('RegisterPaymentRequestSchema', () => {
    const validInput = {
        id: 'txn-001',
        accountId: 'acc-001',
        amount: 100.50,
    };

    describe('valid inputs', () => {
        it('should accept a valid payment request', () => {
            const result = RegisterPaymentRequestSchema.safeParse(validInput);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toEqual(validInput);
            }
        });

        it('should accept id at max length of 36 characters', () => {
            const input = { ...validInput, id: 'a'.repeat(36) };

            const result = RegisterPaymentRequestSchema.safeParse(input);

            expect(result.success).toBe(true);
        });

        it('should accept accountId at max length of 36 characters', () => {
            const input = { ...validInput, accountId: 'b'.repeat(36) };

            const result = RegisterPaymentRequestSchema.safeParse(input);

            expect(result.success).toBe(true);
        });

        it('should accept amount of 0.01 (minimum positive)', () => {
            const input = { ...validInput, amount: 0.01 };

            const result = RegisterPaymentRequestSchema.safeParse(input);

            expect(result.success).toBe(true);
        });

        it('should accept amount at max value of 999999999.99', () => {
            const input = { ...validInput, amount: 999_999_999.99 };

            const result = RegisterPaymentRequestSchema.safeParse(input);

            expect(result.success).toBe(true);
        });
    });

    describe('id field validation', () => {
        it('should reject empty string id', () => {
            const input = { ...validInput, id: '' };

            const result = RegisterPaymentRequestSchema.safeParse(input);

            expect(result.success).toBe(false);
        });

        it('should reject id exceeding 36 characters', () => {
            const input = { ...validInput, id: 'a'.repeat(37) };

            const result = RegisterPaymentRequestSchema.safeParse(input);

            expect(result.success).toBe(false);
        });
    });

    describe('accountId field validation', () => {
        it('should reject empty string accountId', () => {
            const input = { ...validInput, accountId: '' };

            const result = RegisterPaymentRequestSchema.safeParse(input);

            expect(result.success).toBe(false);
        });

        it('should reject accountId exceeding 36 characters', () => {
            const input = { ...validInput, accountId: 'b'.repeat(37) };

            const result = RegisterPaymentRequestSchema.safeParse(input);

            expect(result.success).toBe(false);
        });
    });

    describe('amount field validation', () => {
        it('should reject amount of 0', () => {
            const input = { ...validInput, amount: 0 };

            const result = RegisterPaymentRequestSchema.safeParse(input);

            expect(result.success).toBe(false);
        });

        it('should reject negative amount', () => {
            const input = { ...validInput, amount: -10 };

            const result = RegisterPaymentRequestSchema.safeParse(input);

            expect(result.success).toBe(false);
        });

        it('should reject amount greater than 999999999.99', () => {
            const input = { ...validInput, amount: 1_000_000_000 };

            const result = RegisterPaymentRequestSchema.safeParse(input);

            expect(result.success).toBe(false);
        });
    });

    describe('missing fields', () => {
        it('should reject when id is missing', () => {
            const { id, ...input } = validInput;

            const result = RegisterPaymentRequestSchema.safeParse(input);

            expect(result.success).toBe(false);
        });

        it('should reject when accountId is missing', () => {
            const { accountId, ...input } = validInput;

            const result = RegisterPaymentRequestSchema.safeParse(input);

            expect(result.success).toBe(false);
        });

        it('should reject when amount is missing', () => {
            const { amount, ...input } = validInput;

            const result = RegisterPaymentRequestSchema.safeParse(input);

            expect(result.success).toBe(false);
        });
    });

    describe('strict mode', () => {
        it('should reject extra properties not defined in the schema', () => {
            const input = { ...validInput, extraField: 'unexpected' };

            const result = RegisterPaymentRequestSchema.safeParse(input);

            expect(result.success).toBe(false);
            if (!result.success) {
                const errorMessage = result.error.issues.map((i) => i.message).join(', ');
                expect(errorMessage.toLowerCase()).toContain('unrecognized');
            }
        });
    });
});
