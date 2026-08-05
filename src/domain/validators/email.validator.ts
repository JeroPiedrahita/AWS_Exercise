import { ValidationError } from '../exceptions/validation.error';
import { ErrorCodes } from '../constants/error-codes';

/**
 * Validates that the email address meets the required format rules.
 *
 * @param email - The email address string to validate
 * @throws {ValidationError} With code INVALID_EMAIL_FORMAT if the email does not contain
 *   exactly one "@" character, the local part is empty, or the domain part is empty
 *   or does not contain at least one "." character
 */
export function validateEmail(email: string): void {
    const atSignCount = email.split('@').length - 1;

    if (atSignCount !== 1) {
        throw new ValidationError(
            ErrorCodes.INVALID_EMAIL_FORMAT,
            ['email'],
            `Email "${email}" does not contain exactly one "@" character`,
            'The email address must contain exactly one "@" character.'
        );
    }

    const atIndex = email.indexOf('@');
    const localPart = email.substring(0, atIndex);
    const domainPart = email.substring(atIndex + 1);

    if (localPart.length === 0) {
        throw new ValidationError(
            ErrorCodes.INVALID_EMAIL_FORMAT,
            ['email'],
            `Email "${email}" has an empty local part`,
            'The email address must have a non-empty local part before "@".'
        );
    }

    if (domainPart.length === 0) {
        throw new ValidationError(
            ErrorCodes.INVALID_EMAIL_FORMAT,
            ['email'],
            `Email "${email}" has an empty domain part`,
            'The email address must have a non-empty domain part after "@".'
        );
    }

    if (!domainPart.includes('.')) {
        throw new ValidationError(
            ErrorCodes.INVALID_EMAIL_FORMAT,
            ['email'],
            `Email "${email}" domain part does not contain at least one "." character`,
            'The email address domain must contain at least one "." character.'
        );
    }
}
