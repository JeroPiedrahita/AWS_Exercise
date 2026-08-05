import { ValidationError } from '../exceptions/validation.error';
import { ErrorCodes } from '../constants/error-codes';
import { CustumerAgeRules } from '../constants/custumers.constants';

/**
 * Validates that a customer's date of birth meets age eligibility requirements.
 *
 * @param dateOfBirth - The customer's date of birth in ISO 8601 format (YYYY-MM-DD)
 * @param currentDate - The current server date used as reference for age calculation
 * @throws {ValidationError} With code INVALID_DATE_OF_BIRTH if date is in the future or age > 150
 * @throws {ValidationError} With code INVALID_AGE if age < 18 complete years
 */
export function validateAge(dateOfBirth: string, currentDate: Date): void {
    const birthDate = new Date(dateOfBirth + 'T00:00:00');

    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    const currentDay = currentDate.getDate();

    const birthYear = birthDate.getFullYear();
    const birthMonth = birthDate.getMonth();
    const birthDay = birthDate.getDate();

    // Check if date is in the future
    const currentDateOnly = new Date(currentYear, currentMonth, currentDay);
    const birthDateOnly = new Date(birthYear, birthMonth, birthDay);

    if (birthDateOnly > currentDateOnly) {
        throw new ValidationError(
            ErrorCodes.INVALID_DATE_OF_BIRTH,
            ['dateOfBirth'],
            `Date of birth ${dateOfBirth} is in the future`,
            'The provided date of birth is invalid.'
        );
    }

    // Calculate complete years
    let age = currentYear - birthYear;
    const hasBirthdayOccurred = currentMonth > birthMonth || (currentMonth === birthMonth && currentDay >= birthDay);

    if (!hasBirthdayOccurred) {
        age--;
    }

    // Check if age exceeds 150
    if (age > CustumerAgeRules.MAXIMUM_AGE) {
        throw new ValidationError(
            ErrorCodes.INVALID_DATE_OF_BIRTH,
            ['dateOfBirth'],
            `Date of birth ${dateOfBirth} results in age ${age} which exceeds 150 years`,
            'The provided date of birth is invalid.'
        );
    }

    // Check if age is less than 18
    if (age < CustumerAgeRules.MINIMUM_AGE) {
        throw new ValidationError(
            ErrorCodes.INVALID_AGE,
            ['dateOfBirth'],
            `Customer age ${age} is below minimum required age of 18`,
            'Customer must be at least 18 years old to create an account.'
        );
    }
}
