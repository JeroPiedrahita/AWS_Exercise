import * as fc from 'fast-check';
import { RegisterPaymentRequestSchema } from '@/infrastructure/inputs/schemas/register-payment.schemas';
import {
    GetTransactionPathParamsSchema,
    TransactionResponseSchema,
} from '@/infrastructure/inputs/schemas/get-transaction.schemas';
import { GenerateDailyReportEventSchema } from '@/infrastructure/inputs/schemas/generate-daily-report.schemas';
import { validateSchema, validateResponse } from '@/infrastructure/inputs/schemas/validation.helper';
import { SchemaLimits } from '@/infrastructure/constants/schema.constants';
import { AccountRules } from '@/domain/constants/account.constants';

/**
 * Property-based tests for Zod DTO validation correctness properties.
 * Each property test validates universal behaviors across all valid/invalid inputs.
 *
 * Library: fast-check
 * Minimum iterations: 100 per property
 */

describe('Property-Based Tests: Zod DTO Validation', () => {
    // Property 1: Schema acceptance boundary
    // **Validates: Requirements 1.1, 2.1, 3.1, 8.1**
    describe('Property 1: Schema acceptance boundary - schema accepts iff all constraints satisfied', () => {
        // --- Generators for RegisterPaymentRequestSchema ---
        const validId = () => fc.string({ minLength: 1, maxLength: SchemaLimits.MAX_UUID_LENGTH });
        const invalidId = () => fc.oneof(
            fc.constant(''),
            fc.string({ minLength: SchemaLimits.MAX_UUID_LENGTH + 1, maxLength: 50 })
        );

        const validAccountId = () => fc.string({ minLength: 1, maxLength: SchemaLimits.MAX_UUID_LENGTH });
        const invalidAccountId = () => fc.oneof(
            fc.constant(''),
            fc.string({ minLength: SchemaLimits.MAX_UUID_LENGTH + 1, maxLength: 50 })
        );

        const validAmount = () => fc.double({ min: 0.01, max: AccountRules.MAX_INITIAL_AMOUNT, noNaN: true });
        const invalidAmount = () => fc.oneof(
            fc.constant(0),
            fc.constant(-1),
            fc.double({ min: AccountRules.MAX_INITIAL_AMOUNT + 0.001, max: 2_000_000_000, noNaN: true })
        );

        const registerPaymentArb = (allValid: boolean) => {
            if (allValid) {
                return fc.record({
                    id: validId(),
                    accountId: validAccountId(),
                    amount: validAmount(),
                });
            }
            // At least one field invalid: pick which fields are invalid
            return fc.record({
                id: fc.boolean().chain((v) => v ? validId() : invalidId()),
                accountId: fc.boolean().chain((v) => v ? validAccountId() : invalidAccountId()),
                amount: fc.boolean().chain((v) => v ? validAmount() : invalidAmount()),
            }).filter((obj) => {
                // Ensure at least one field is actually invalid
                const idValid = typeof obj.id === 'string' && obj.id.length >= 1 && obj.id.length <= SchemaLimits.MAX_UUID_LENGTH;
                const accountIdValid = typeof obj.accountId === 'string' && obj.accountId.length >= 1 && obj.accountId.length <= SchemaLimits.MAX_UUID_LENGTH;
                const amountValid = typeof obj.amount === 'number' && obj.amount > 0 && obj.amount <= AccountRules.MAX_INITIAL_AMOUNT;
                return !(idValid && accountIdValid && amountValid);
            });
        };

        it('RegisterPaymentRequestSchema accepts valid inputs and rejects invalid ones', () => {
            // All valid → accepts
            fc.assert(
                fc.property(registerPaymentArb(true), (input) => {
                    const result = RegisterPaymentRequestSchema.safeParse(input);
                    return result.success === true;
                }),
                { numRuns: 100 }
            );

            // At least one invalid → rejects
            fc.assert(
                fc.property(registerPaymentArb(false), (input) => {
                    const result = RegisterPaymentRequestSchema.safeParse(input);
                    return result.success === false;
                }),
                { numRuns: 100 }
            );
        });

        // --- Generators for GetTransactionPathParamsSchema ---
        const validPathId = () => fc.string({ minLength: 1, maxLength: SchemaLimits.MAX_TRANSACTION_ID_LENGTH }).filter((s) => s.trim().length >= 1);
        const invalidPathId = () => fc.oneof(
            fc.constant(''),
            fc.constant('   '),
            // Generate strings whose trimmed length exceeds MAX_TRANSACTION_ID_LENGTH
            fc.string({ minLength: SchemaLimits.MAX_TRANSACTION_ID_LENGTH + 1, maxLength: 200 })
                .filter((s) => s.trim().length > SchemaLimits.MAX_TRANSACTION_ID_LENGTH)
        );

        it('GetTransactionPathParamsSchema accepts valid inputs and rejects invalid ones', () => {
            // All valid → accepts
            fc.assert(
                fc.property(validPathId(), (id) => {
                    const result = GetTransactionPathParamsSchema.safeParse({ id });
                    return result.success === true;
                }),
                { numRuns: 100 }
            );

            // Invalid → rejects
            fc.assert(
                fc.property(invalidPathId(), (id) => {
                    const result = GetTransactionPathParamsSchema.safeParse({ id });
                    return result.success === false;
                }),
                { numRuns: 100 }
            );
        });

        // --- Generators for GenerateDailyReportEventSchema ---
        const validSource = () => fc.string({ minLength: 1, maxLength: SchemaLimits.MAX_EVENT_FIELD_LENGTH });
        const invalidSource = () => fc.oneof(
            fc.constant(''),
            fc.string({ minLength: SchemaLimits.MAX_EVENT_FIELD_LENGTH + 1, maxLength: 300 })
        );

        const validDetailType = () => fc.string({ minLength: 1, maxLength: SchemaLimits.MAX_EVENT_FIELD_LENGTH });
        const invalidDetailType = () => fc.oneof(
            fc.constant(''),
            fc.string({ minLength: SchemaLimits.MAX_EVENT_FIELD_LENGTH + 1, maxLength: 300 })
        );

        const validDetail = () => fc.object();

        const dailyReportArb = (allValid: boolean) => {
            if (allValid) {
                return fc.record({
                    source: validSource(),
                    'detail-type': validDetailType(),
                    detail: validDetail(),
                });
            }
            return fc.record({
                source: fc.boolean().chain((v) => v ? validSource() : invalidSource()),
                'detail-type': fc.boolean().chain((v) => v ? validDetailType() : invalidDetailType()),
                detail: validDetail(),
            }).filter((obj) => {
                const sourceValid = typeof obj.source === 'string' && obj.source.length >= 1 && obj.source.length <= SchemaLimits.MAX_EVENT_FIELD_LENGTH;
                const detailTypeValid = typeof obj['detail-type'] === 'string' && obj['detail-type'].length >= 1 && obj['detail-type'].length <= SchemaLimits.MAX_EVENT_FIELD_LENGTH;
                return !(sourceValid && detailTypeValid);
            });
        };

        it('GenerateDailyReportEventSchema accepts valid inputs and rejects invalid ones', () => {
            // All valid → accepts
            fc.assert(
                fc.property(dailyReportArb(true), (input) => {
                    const result = GenerateDailyReportEventSchema.safeParse(input);
                    return result.success === true;
                }),
                { numRuns: 100 }
            );

            // At least one invalid → rejects
            fc.assert(
                fc.property(dailyReportArb(false), (input) => {
                    const result = GenerateDailyReportEventSchema.safeParse(input);
                    return result.success === false;
                }),
                { numRuns: 100 }
            );
        });

        // --- Generators for TransactionResponseSchema ---
        const validTxnId = () => fc.string({ minLength: 1, maxLength: 50 });
        const invalidTxnId = () => fc.constant('');

        const validTxnAccountId = () => fc.string({ minLength: 1, maxLength: 50 });
        const invalidTxnAccountId = () => fc.constant('');

        const validTxnAmount = () => fc.double({ min: 0.01, max: AccountRules.MAX_INITIAL_AMOUNT, noNaN: true });
        const invalidTxnAmount = () => fc.oneof(fc.constant(0), fc.constant(-1));

        const validStatus = () => fc.constantFrom('PENDING', 'COMPLETED', 'FAILED');
        const invalidStatus = () => fc.constantFrom('UNKNOWN', 'pending', 'cancelled', '');

        const validCreatedAt = () => fc.integer({ min: 946684800000, max: 4102444800000 })
            .map((ms) => new Date(ms).toISOString());
        const invalidCreatedAt = () => fc.constantFrom('not-a-date', '2024-13-45', '');

        const transactionResponseArb = (allValid: boolean) => {
            if (allValid) {
                return fc.record({
                    id: validTxnId(),
                    accountId: validTxnAccountId(),
                    amount: validTxnAmount(),
                    status: validStatus(),
                    createdAt: validCreatedAt(),
                });
            }
            return fc.tuple(
                fc.boolean(),
                fc.boolean(),
                fc.boolean(),
                fc.boolean(),
                fc.boolean()
            ).filter((flags) => !flags.every((f) => f))
            .chain(([idOk, accOk, amtOk, statusOk, dateOk]) =>
                fc.record({
                    id: idOk ? validTxnId() : invalidTxnId(),
                    accountId: accOk ? validTxnAccountId() : invalidTxnAccountId(),
                    amount: amtOk ? validTxnAmount() : invalidTxnAmount(),
                    status: statusOk ? validStatus() : invalidStatus(),
                    createdAt: dateOk ? validCreatedAt() : invalidCreatedAt(),
                })
            );
        };

        it('TransactionResponseSchema accepts valid inputs and rejects invalid ones', () => {
            // All valid → accepts
            fc.assert(
                fc.property(transactionResponseArb(true), (input) => {
                    const result = TransactionResponseSchema.safeParse(input);
                    return result.success === true;
                }),
                { numRuns: 100 }
            );

            // At least one invalid → rejects
            fc.assert(
                fc.property(transactionResponseArb(false), (input) => {
                    const result = TransactionResponseSchema.safeParse(input);
                    return result.success === false;
                }),
                { numRuns: 100 }
            );
        });
    });

    // Property 2: Validation pass-through preserves data
    // **Validates: Requirements 1.2, 2.2, 4.4**
    describe('Property 2: Validation pass-through preserves data - safeParse(valid).data equals input', () => {
        it('RegisterPaymentRequestSchema preserves valid input data', () => {
            const validRegisterPaymentArb = fc.record({
                id: fc.string({ minLength: 1, maxLength: SchemaLimits.MAX_UUID_LENGTH }),
                accountId: fc.string({ minLength: 1, maxLength: SchemaLimits.MAX_UUID_LENGTH }),
                amount: fc.double({ min: 0.01, max: AccountRules.MAX_INITIAL_AMOUNT, noNaN: true }),
            });

            fc.assert(
                fc.property(validRegisterPaymentArb, (input) => {
                    const result = RegisterPaymentRequestSchema.safeParse(input);
                    expect(result.success).toBe(true);
                    if (result.success) {
                        expect(result.data).toEqual(input);
                    }
                }),
                { numRuns: 100 }
            );
        });

        it('GetTransactionPathParamsSchema preserves valid input data (trimmed id)', () => {
            const validPathParamsArb = fc.record({
                id: fc.tuple(
                    fc.nat({ max: 5 }).map((n) => ' '.repeat(n)),
                    fc.string({ minLength: 1, maxLength: SchemaLimits.MAX_TRANSACTION_ID_LENGTH - 10 }).filter((s) => s.trim().length >= 1),
                    fc.nat({ max: 5 }).map((n) => ' '.repeat(n))
                ).map(([leading, core, trailing]) => `${leading}${core}${trailing}`)
                 .filter((s) => s.length >= 1 && s.length <= SchemaLimits.MAX_TRANSACTION_ID_LENGTH),
            });

            fc.assert(
                fc.property(validPathParamsArb, (input) => {
                    const result = GetTransactionPathParamsSchema.safeParse(input);
                    expect(result.success).toBe(true);
                    if (result.success) {
                        expect(result.data.id).toEqual(input.id.trim());
                    }
                }),
                { numRuns: 100 }
            );
        });

        it('GenerateDailyReportEventSchema preserves valid input data', () => {
            // Use a safe object generator that avoids prototype-polluting keys like __proto__
            const safeKeyArb = fc.string({ minLength: 1, maxLength: 20 }).filter(
                (key) => key !== '__proto__' && key !== 'constructor' && key !== 'prototype'
            );
            const safeObjectArb = fc.dictionary(safeKeyArb, fc.oneof(
                fc.string(),
                fc.integer(),
                fc.boolean(),
                fc.constant(null)
            ));

            const validDailyReportArb = fc.record({
                source: fc.string({ minLength: 1, maxLength: SchemaLimits.MAX_EVENT_FIELD_LENGTH }),
                'detail-type': fc.string({ minLength: 1, maxLength: SchemaLimits.MAX_EVENT_FIELD_LENGTH }),
                detail: safeObjectArb,
            });

            fc.assert(
                fc.property(validDailyReportArb, (input) => {
                    const result = GenerateDailyReportEventSchema.safeParse(input);
                    expect(result.success).toBe(true);
                    if (result.success) {
                        expect(result.data).toEqual(input);
                    }
                }),
                { numRuns: 100 }
            );
        });

        it('TransactionResponseSchema preserves valid input data', () => {
            const validTransactionResponseArb = fc.record({
                id: fc.string({ minLength: 1, maxLength: 50 }),
                accountId: fc.string({ minLength: 1, maxLength: 50 }),
                amount: fc.double({ min: 0.01, max: AccountRules.MAX_INITIAL_AMOUNT, noNaN: true }),
                status: fc.constantFrom('PENDING', 'COMPLETED', 'FAILED'),
                createdAt: fc.integer({ min: 946684800000, max: 4102444800000 })
                    .map((ms) => new Date(ms).toISOString()),
            });

            fc.assert(
                fc.property(validTransactionResponseArb, (input) => {
                    const result = TransactionResponseSchema.safeParse(input);
                    expect(result.success).toBe(true);
                    if (result.success) {
                        expect(result.data).toEqual(input);
                    }
                }),
                { numRuns: 100 }
            );
        });
    });

    // Property 3: Validation errors reference failing field paths
    // **Validates: Requirements 1.3, 2.3, 3.3**
    describe('Property 3: Validation errors reference failing field paths - error string contains dot-path of failing fields', () => {
        it('RegisterPaymentRequestSchema error contains path of each invalid field', () => {
            // Generator for invalid field combinations
            const invalidFieldsArb = fc.record({
                invalidateId: fc.boolean(),
                invalidateAmount: fc.boolean(),
                invalidateAccountId: fc.boolean(),
            }).filter((flags) => flags.invalidateId || flags.invalidateAmount || flags.invalidateAccountId);

            fc.assert(
                fc.property(invalidFieldsArb, (flags) => {
                    const input = {
                        id: flags.invalidateId ? '' : 'valid-id',
                        amount: flags.invalidateAmount ? 0 : 100,
                        accountId: flags.invalidateAccountId ? '' : 'valid-account',
                    };

                    const result = validateSchema(RegisterPaymentRequestSchema, input);
                    expect(result.success).toBe(false);
                    if (!result.success) {
                        if (flags.invalidateId) {
                            expect(result.error).toContain('id');
                        }
                        if (flags.invalidateAmount) {
                            expect(result.error).toContain('amount');
                        }
                        if (flags.invalidateAccountId) {
                            expect(result.error).toContain('accountId');
                        }
                    }
                }),
                { numRuns: 100 }
            );
        });

        it('GetTransactionPathParamsSchema error contains "id" when id is invalid', () => {
            const invalidIdArb = fc.oneof(
                fc.constant(''),
                fc.constant('   '),
                fc.constant('\t')
            );

            fc.assert(
                fc.property(invalidIdArb, (id) => {
                    const result = validateSchema(GetTransactionPathParamsSchema, { id });
                    expect(result.success).toBe(false);
                    if (!result.success) {
                        expect(result.error).toContain('id');
                    }
                }),
                { numRuns: 100 }
            );
        });

        it('GenerateDailyReportEventSchema error contains path of each invalid field', () => {
            const invalidFieldsArb = fc.record({
                invalidateSource: fc.boolean(),
                invalidateDetailType: fc.boolean(),
            }).filter((flags) => flags.invalidateSource || flags.invalidateDetailType);

            fc.assert(
                fc.property(invalidFieldsArb, (flags) => {
                    const input = {
                        source: flags.invalidateSource ? '' : 'valid-source',
                        'detail-type': flags.invalidateDetailType ? '' : 'valid-detail-type',
                        detail: {},
                    };

                    const result = validateSchema(GenerateDailyReportEventSchema, input);
                    expect(result.success).toBe(false);
                    if (!result.success) {
                        if (flags.invalidateSource) {
                            expect(result.error).toContain('source');
                        }
                        if (flags.invalidateDetailType) {
                            expect(result.error).toContain('detail-type');
                        }
                    }
                }),
                { numRuns: 100 }
            );
        });
    });

    // Property 4: Strict mode rejects unknown properties
    // **Validates: Requirements 1.6**
    describe('Property 4: Strict mode rejects unknown properties - RegisterPaymentRequest rejects extra keys', () => {
        it('RegisterPaymentRequestSchema rejects valid input with additional unknown properties', () => {
            const validBaseArb = fc.record({
                id: fc.string({ minLength: 1, maxLength: SchemaLimits.MAX_UUID_LENGTH }),
                accountId: fc.string({ minLength: 1, maxLength: SchemaLimits.MAX_UUID_LENGTH }),
                amount: fc.double({ min: 0.01, max: AccountRules.MAX_INITIAL_AMOUNT, noNaN: true }),
            });

            const extraKeysArb = fc.array(
                fc.tuple(
                    fc.string({ minLength: 1 }).filter((key) => !['id', 'accountId', 'amount'].includes(key)),
                    fc.anything()
                ),
                { minLength: 1, maxLength: 5 }
            );

            fc.assert(
                fc.property(validBaseArb, extraKeysArb, (base, extraEntries) => {
                    const input = { ...base };
                    for (const [key, value] of extraEntries) {
                        (input as Record<string, unknown>)[key] = value;
                    }

                    const result = RegisterPaymentRequestSchema.safeParse(input);
                    expect(result.success).toBe(false);

                    const validationResult = validateSchema(RegisterPaymentRequestSchema, input);
                    expect(validationResult.success).toBe(false);
                    if (!validationResult.success) {
                        // Check that the error references at least one unrecognized key
                        const referencesUnknownKey = extraEntries.some(([key]) =>
                            validationResult.error.includes(key)
                        );
                        expect(referencesUnknownKey).toBe(true);
                    }
                }),
                { numRuns: 100 }
            );
        });
    });

    // Property 5: Multi-field error aggregation format
    // **Validates: Requirements 4.1, 4.2**
    describe('Property 5: Multi-field error aggregation format - N-1 occurrences of ", " separator for N errors', () => {
        const fieldNames = ['id', 'accountId', 'amount'] as const;

        // Generate a subset of fields to invalidate (at least 2)
        const invalidFieldSubsetArb = fc.subarray([...fieldNames], { minLength: 2 });

        // Build an input object where exactly the chosen fields are invalid
        const buildInput = (invalidFields: typeof fieldNames[number][]) => {
            return {
                id: invalidFields.includes('id') ? '' : 'valid-id',
                accountId: invalidFields.includes('accountId') ? '' : 'valid-account',
                amount: invalidFields.includes('amount') ? 0 : 100,
            };
        };

        it('error string contains exactly N-1 comma separators when N fields fail validation', () => {
            fc.assert(
                fc.property(invalidFieldSubsetArb, (invalidFields) => {
                    const input = buildInput(invalidFields);
                    const result = validateSchema(RegisterPaymentRequestSchema, input);

                    expect(result.success).toBe(false);
                    if (!result.success) {
                        const expectedSeparatorCount = invalidFields.length - 1;
                        const actualSeparatorCount = result.error.split(', ').length - 1;
                        expect(actualSeparatorCount).toBe(expectedSeparatorCount);

                        // Each invalid field path appears in the error string
                        for (const field of invalidFields) {
                            expect(result.error).toContain(field);
                        }
                    }
                }),
                { numRuns: 100 }
            );
        });
    });

    // Property 6: Response contract violation throws
    // **Validates: Requirements 8.3**
    describe('Property 6: Response contract violation throws - validateResponse throws with "Response contract violation"', () => {
        // Generators for invalid TransactionResponse fields
        const validTxnId = () => fc.string({ minLength: 1, maxLength: 50 });
        const invalidTxnId = () => fc.constant('');

        const validTxnAccountId = () => fc.string({ minLength: 1, maxLength: 50 });
        const invalidTxnAccountId = () => fc.constant('');

        const validTxnAmount = () => fc.double({ min: 0.01, max: AccountRules.MAX_INITIAL_AMOUNT, noNaN: true });
        const invalidTxnAmount = () => fc.oneof(fc.constant(0), fc.constant(-1));

        const validStatus = () => fc.constantFrom('PENDING', 'COMPLETED', 'FAILED');
        const invalidStatus = () => fc.constantFrom('UNKNOWN', 'pending', 'cancelled', '');

        const validCreatedAt = () => fc.integer({ min: 946684800000, max: 4102444800000 })
            .map((ms) => new Date(ms).toISOString());
        const invalidCreatedAt = () => fc.constantFrom('not-a-date', '2024-13-45', '');

        // Maps field names to their invalid/valid generators
        const fieldGenerators = {
            id: { valid: validTxnId, invalid: invalidTxnId },
            accountId: { valid: validTxnAccountId, invalid: invalidTxnAccountId },
            amount: { valid: validTxnAmount, invalid: invalidTxnAmount },
            status: { valid: validStatus, invalid: invalidStatus },
            createdAt: { valid: validCreatedAt, invalid: invalidCreatedAt },
        };

        const fieldNames = Object.keys(fieldGenerators) as (keyof typeof fieldGenerators)[];

        // Generator: produces objects with at least one invalid field, tracking which fields are invalid
        const invalidTransactionResponseArb = fc.tuple(
            fc.boolean(),
            fc.boolean(),
            fc.boolean(),
            fc.boolean(),
            fc.boolean()
        ).filter((flags) => !flags.every((f) => f))
        .chain(([idOk, accOk, amtOk, statusOk, dateOk]) => {
            const flags = [idOk, accOk, amtOk, statusOk, dateOk];
            return fc.record({
                id: idOk ? validTxnId() : invalidTxnId(),
                accountId: accOk ? validTxnAccountId() : invalidTxnAccountId(),
                amount: amtOk ? validTxnAmount() : invalidTxnAmount(),
                status: statusOk ? validStatus() : invalidStatus(),
                createdAt: dateOk ? validCreatedAt() : invalidCreatedAt(),
            }).map((obj) => ({
                data: obj,
                invalidFields: fieldNames.filter((_, i) => !flags[i]),
            }));
        });

        it('validateResponse throws Error with "Response contract violation" and failing field path', () => {
            fc.assert(
                fc.property(invalidTransactionResponseArb, ({ data, invalidFields }) => {
                    expect(() => validateResponse(TransactionResponseSchema, data)).toThrow(Error);

                    try {
                        validateResponse(TransactionResponseSchema, data);
                    } catch (err) {
                        expect(err).toBeInstanceOf(Error);
                        const message = (err as Error).message;
                        expect(message).toContain('Response contract violation');

                        // Error message contains the path of at least one failing field
                        const containsAtLeastOneField = invalidFields.some((field) =>
                            message.includes(field)
                        );
                        expect(containsAtLeastOneField).toBe(true);
                    }
                }),
                { numRuns: 100 }
            );
        });
    });
});
