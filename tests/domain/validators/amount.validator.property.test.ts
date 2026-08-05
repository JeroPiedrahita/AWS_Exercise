import fc from 'fast-check';
import { validateAmount } from '@/domain/validators/amount.validator';
import { ValidationError } from '@/domain/exceptions/validation.error';
import { ErrorCodes } from '@/domain/constants/error-codes';
import { AccountRules } from '@/domain/constants/account.constants';

/**
 * Property-based tests for amount validator.
 *
 * 
 */
describe('validateAmount - Property Tests', () => {
    /**
     * Property 5: Amount validation rejects all invalid values
     *
     * For any number that is negative, or greater than 999,999,999.99, or has more than
     * 2 decimal places, the system SHALL reject the request with error code
     * INVALID_INITIAL_AMOUNT. For any number in [0, 999999999.99] with at most 2 decimal
     * places, the amount validation SHALL pass.
     */
    describe('Property 5: Amount validation rejects all invalid values', () => {
        it('should reject with INVALID_INITIAL_AMOUNT when amount is negative', () => {
            fc.assert(
                fc.property(
                    negativeAmount(),
                    (amount) => {
                        try {
                            validateAmount(amount);
                            return false; // Should have thrown
                        } catch (error) {
                            if (!(error instanceof ValidationError)) return false;
                            return error.code === ErrorCodes.INVALID_INITIAL_AMOUNT;
                        }
                    }
                ),
                { numRuns: 200 }
            );
        });

        it('should reject with INVALID_INITIAL_AMOUNT when amount exceeds 999,999,999.99', () => {
            fc.assert(
                fc.property(
                    excessiveAmount(),
                    (amount) => {
                        try {
                            validateAmount(amount);
                            return false; // Should have thrown
                        } catch (error) {
                            if (!(error instanceof ValidationError)) return false;
                            return error.code === ErrorCodes.INVALID_INITIAL_AMOUNT;
                        }
                    }
                ),
                { numRuns: 200 }
            );
        });

        it('should reject with INVALID_INITIAL_AMOUNT when amount has more than 2 decimal places', () => {
            fc.assert(
                fc.property(
                    tooManyDecimalPlaces(),
                    (amount) => {
                        try {
                            validateAmount(amount);
                            return false; // Should have thrown
                        } catch (error) {
                            if (!(error instanceof ValidationError)) return false;
                            return error.code === ErrorCodes.INVALID_INITIAL_AMOUNT;
                        }
                    }
                ),
                { numRuns: 200 }
            );
        });

        it('should pass validation when amount is in [0, 999999999.99] with at most 2 decimal places', () => {
            fc.assert(
                fc.property(
                    validAmount(),
                    (amount) => {
                        try {
                            validateAmount(amount);
                            return true;
                        } catch {
                            return false;
                        }
                    }
                ),
                { numRuns: 200 }
            );
        });
    });
});

// --- Helper Generators ---

/**
 * Generates a negative number (strictly less than 0).
 */
function negativeAmount(): fc.Arbitrary<number> {
    return fc.oneof(
        fc.double({ min: -AccountRules.MAX_INITIAL_AMOUNT, max: -0.01, noNaN: true }),
        fc.integer({ min: -Math.floor(AccountRules.MAX_INITIAL_AMOUNT), max: -1 })
    );
}

/**
 * Generates a number strictly greater than MAX_INITIAL_AMOUNT.
 */
function excessiveAmount(): fc.Arbitrary<number> {
    const minExcessive = Math.ceil(AccountRules.MAX_INITIAL_AMOUNT) + 1;
    return fc.oneof(
        fc.double({ min: minExcessive, max: minExcessive * 10, noNaN: true }),
        fc.integer({ min: minExcessive, max: minExcessive * 10 })
    );
}

/**
 * Generates a number in [0, MAX_INITIAL_AMOUNT] that has more than MAX_DECIMALS decimal places.
 * Strategy: generate an integer part and a fractional part with (MAX_DECIMALS + 1)+ decimal digits.
 */
function tooManyDecimalPlaces(): fc.Arbitrary<number> {
    return fc.record({
        integerPart: fc.integer({ min: 0, max: Math.floor(AccountRules.MAX_INITIAL_AMOUNT) }),
        decimalDigits: fc.integer({ min: AccountRules.MAX_DECIMALS + 1, max: 6 }),
    }).chain(({ integerPart, decimalDigits }) =>
        fc.integer({ min: 1, max: Math.pow(10, decimalDigits) - 1 })
            .map((fractionalInt) => {
                const fractionalStr = fractionalInt.toString().padStart(decimalDigits, '0');
                // Ensure the last digit is non-zero so we truly have > MAX_DECIMALS decimal places
                const lastNonZeroIndex = fractionalStr.length - 1;
                let adjustedStr = fractionalStr;
                if (adjustedStr[lastNonZeroIndex] === '0') {
                    adjustedStr = adjustedStr.substring(0, lastNonZeroIndex) + '1';
                }
                // Ensure we actually have > MAX_DECIMALS meaningful decimal digits
                // by ensuring a digit beyond position MAX_DECIMALS is non-zero
                if (adjustedStr.length > AccountRules.MAX_DECIMALS) {
                    const beyondMax = adjustedStr.substring(AccountRules.MAX_DECIMALS);
                    if (beyondMax.split('').every((c) => c === '0')) {
                        adjustedStr = adjustedStr.substring(0, AccountRules.MAX_DECIMALS) + '1' + adjustedStr.substring(AccountRules.MAX_DECIMALS + 1);
                    }
                }
                return parseFloat(`${integerPart}.${adjustedStr}`);
            })
            .filter((amount) => {
                // Verify the number actually has > MAX_DECIMALS decimal places when converted to string
                const decimalPart = amount.toString().split('.')[1];
                return decimalPart !== undefined && decimalPart.length > AccountRules.MAX_DECIMALS;
            })
    );
}

/**
 * Generates a valid amount: a number in [0, MAX_INITIAL_AMOUNT] with at most MAX_DECIMALS decimal places.
 * Strategy: generate cents as an integer and convert to a dollar amount.
 */
function validAmount(): fc.Arbitrary<number> {
    // Generate amount as integer cents [0, MAX_INITIAL_AMOUNT * 10^MAX_DECIMALS] and divide by 10^MAX_DECIMALS
    // This guarantees at most MAX_DECIMALS decimal places
    const factor = Math.pow(10, AccountRules.MAX_DECIMALS);
    const maxCents = Math.floor(AccountRules.MAX_INITIAL_AMOUNT * factor);
    return fc.integer({ min: 0, max: maxCents }).map((cents) => cents / factor);
}
