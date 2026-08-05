import { validateAge } from '@/domain/validators/age.validator';
import { ValidationError } from '@/domain/exceptions/validation.error';
import { ErrorCodes } from '@/domain/constants/error-codes';

describe('validateAge', () => {
    describe('valid ages (18-150)', () => {
        it('should pass for exactly 18 years old (birthday today)', () => {
            const currentDate = new Date(2024, 5, 15); // June 15, 2024
            const dateOfBirth = '2006-06-15'; // Exactly 18 years ago

            expect(() => validateAge(dateOfBirth, currentDate)).not.toThrow();
        });

        it('should pass for a 30-year-old customer', () => {
            const currentDate = new Date(2024, 5, 15); // June 15, 2024
            const dateOfBirth = '1994-03-10';

            expect(() => validateAge(dateOfBirth, currentDate)).not.toThrow();
        });

        it('should pass for exactly 150 years old', () => {
            const currentDate = new Date(2024, 0, 1); // January 1, 2024
            const dateOfBirth = '1874-01-01';

            expect(() => validateAge(dateOfBirth, currentDate)).not.toThrow();
        });
    });

    describe('INVALID_AGE (age < 18)', () => {
        it('should throw INVALID_AGE for a 17-year-old (birthday tomorrow)', () => {
            const currentDate = new Date(2024, 5, 14); // June 14, 2024
            const dateOfBirth = '2006-06-15'; // Turns 18 tomorrow

            expect(() => validateAge(dateOfBirth, currentDate)).toThrow(ValidationError);
            try {
                validateAge(dateOfBirth, currentDate);
            } catch (error) {
                const validationError = error as ValidationError;
                expect(validationError.code).toBe(ErrorCodes.INVALID_AGE);
                expect(validationError.fields).toContain('dateOfBirth');
            }
        });

        it('should throw INVALID_AGE for a newborn', () => {
            const currentDate = new Date(2024, 4, 15);
            const dateOfBirth = '2024-05-01';

            expect(() => validateAge(dateOfBirth, currentDate)).toThrow(ValidationError);
            try {
                validateAge(dateOfBirth, currentDate);
            } catch (error) {
                const validationError = error as ValidationError;
                expect(validationError.code).toBe(ErrorCodes.INVALID_AGE);
            }
        });

        it('should throw INVALID_AGE when birthday has not been reached this year', () => {
            const currentDate = new Date(2024, 0, 15); // January 15, 2024
            const dateOfBirth = '2006-06-15'; // Birthday is in June — still 17

            expect(() => validateAge(dateOfBirth, currentDate)).toThrow(ValidationError);
            try {
                validateAge(dateOfBirth, currentDate);
            } catch (error) {
                const validationError = error as ValidationError;
                expect(validationError.code).toBe(ErrorCodes.INVALID_AGE);
            }
        });
    });

    describe('INVALID_DATE_OF_BIRTH (future date or age > 150)', () => {
        it('should throw INVALID_DATE_OF_BIRTH for a future date', () => {
            const currentDate = new Date(2024, 5, 15); // June 15, 2024
            const dateOfBirth = '2025-01-01';

            expect(() => validateAge(dateOfBirth, currentDate)).toThrow(ValidationError);
            try {
                validateAge(dateOfBirth, currentDate);
            } catch (error) {
                const validationError = error as ValidationError;
                expect(validationError.code).toBe(ErrorCodes.INVALID_DATE_OF_BIRTH);
                expect(validationError.fields).toContain('dateOfBirth');
            }
        });

        it('should throw INVALID_DATE_OF_BIRTH for age > 150', () => {
            const currentDate = new Date(2024, 5, 15); // June 15, 2024
            const dateOfBirth = '1870-01-01'; // 154 years old

            expect(() => validateAge(dateOfBirth, currentDate)).toThrow(ValidationError);
            try {
                validateAge(dateOfBirth, currentDate);
            } catch (error) {
                const validationError = error as ValidationError;
                expect(validationError.code).toBe(ErrorCodes.INVALID_DATE_OF_BIRTH);
            }
        });

        it('should throw INVALID_DATE_OF_BIRTH for tomorrow', () => {
            const currentDate = new Date(2024, 5, 15); // June 15, 2024
            const dateOfBirth = '2024-06-16'; // Tomorrow

            expect(() => validateAge(dateOfBirth, currentDate)).toThrow(ValidationError);
            try {
                validateAge(dateOfBirth, currentDate);
            } catch (error) {
                const validationError = error as ValidationError;
                expect(validationError.code).toBe(ErrorCodes.INVALID_DATE_OF_BIRTH);
            }
        });
    });

    describe('complete years calculation', () => {
        it('should not count a year as complete if birth month has not been reached', () => {
            // Born Dec 31, 2006. On Jan 1, 2024, they are still 17 (birthday not reached).
            const currentDate = new Date(2024, 0, 1); // January 1, 2024
            const dateOfBirth = '2006-12-31';

            expect(() => validateAge(dateOfBirth, currentDate)).toThrow(ValidationError);
            try {
                validateAge(dateOfBirth, currentDate);
            } catch (error) {
                const validationError = error as ValidationError;
                expect(validationError.code).toBe(ErrorCodes.INVALID_AGE);
            }
        });

        it('should count a year as complete if same month and same day', () => {
            // Born March 15, 2006. On March 15, 2024, they are 18.
            const currentDate = new Date(2024, 2, 15); // March 15, 2024
            const dateOfBirth = '2006-03-15';

            expect(() => validateAge(dateOfBirth, currentDate)).not.toThrow();
        });

        it('should not count a year as complete if same month but day not reached', () => {
            // Born March 15, 2006. On March 14, 2024, they are still 17.
            const currentDate = new Date(2024, 2, 14); // March 14, 2024
            const dateOfBirth = '2006-03-15';

            expect(() => validateAge(dateOfBirth, currentDate)).toThrow(ValidationError);
            try {
                validateAge(dateOfBirth, currentDate);
            } catch (error) {
                const validationError = error as ValidationError;
                expect(validationError.code).toBe(ErrorCodes.INVALID_AGE);
            }
        });
    });
});
