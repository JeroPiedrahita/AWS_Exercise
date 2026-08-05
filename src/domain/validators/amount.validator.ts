import { ValidationError } from '../exceptions/validation.error';
import { ErrorCodes } from '../constants/error-codes';
import { AccountRules } from '../constants/account.constants';

/**
 * Validates that the initial amount meets business rules for account creation.
 *
 * @param amount - The initial deposit amount to validate
 * @throws {ValidationError} With code INVALID_INITIAL_AMOUNT if amount is negative,
 *   exceeds 999,999,999.99, or has more than 2 decimal places
 */
export function validateAmount(amount: number): void {
    if (amount < AccountRules.MIN_INITIAL_AMOUNT) {
        throw new ValidationError(
            ErrorCodes.INVALID_INITIAL_AMOUNT,
            ['initialAmount'],
            `Initial amount ${amount} is negative`,
            'The initial amount must be zero or a positive number.'
        );
    }

    if (amount > AccountRules.MAX_INITIAL_AMOUNT) {
        throw new ValidationError(
            ErrorCodes.INVALID_INITIAL_AMOUNT,
            ['initialAmount'],
            `Initial amount ${amount} exceeds maximum allowed value of 999999999.99`,
            'The initial amount exceeds the maximum allowed value.'
        );
    }

    const decimalPart = amount.toString().split('.')[1];
    if (decimalPart && decimalPart.length > AccountRules.MAX_DECIMALS) {
        throw new ValidationError(
            ErrorCodes.INVALID_INITIAL_AMOUNT,
            ['initialAmount'],
            `Initial amount ${amount} has more than 2 decimal places`,
            'The initial amount must have at most 2 decimal places.'
        );
    }
}
