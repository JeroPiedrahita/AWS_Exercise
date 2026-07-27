import fc from 'fast-check';
import { validateAge } from '@/domain/validators/age.validator';
import { ValidationError } from '@/domain/exceptions/validation.error';
import { ErrorCodes } from '@/domain/constants/error-codes';
import { CustumerAgeRules } from '@/domain/constants/custumers.constants';

/**
 * Property-based tests for age validator.
 *
 */
describe('validateAge - Property Tests', () => {
    /**
     * Age validation with complete years calculation
     *
     * For any date of birth and reference date where the number of complete years elapsed
     * (a year is complete only if the birth month and day have been reached) is less than 18,
     * the system SHALL reject the request with error code INVALID_AGE. Conversely, for any
     * date of birth where complete years ≥ 18 and ≤ 150, the age validation SHALL pass.
     *
     */
    describe('Property 3: Age validation with complete years calculation', () => {
        it('should reject with INVALID_AGE when complete years < 18', () => {
            fc.assert(
                fc.property(
                    generateUnderageScenario(),
                    ({ dateOfBirth, currentDate }) => {
                        const dobStr = formatDate(dateOfBirth);

                        try {
                            validateAge(dobStr, currentDate);
                            return false; // Should have thrown
                        } catch (error) {
                            if (!(error instanceof ValidationError)) return false;
                            return error.code === ErrorCodes.INVALID_AGE;
                        }
                    }
                ),
                { numRuns: 200 }
            );
        });

        it('should pass validation when complete years >= 18 and <= 150', () => {
            fc.assert(
                fc.property(
                    generateValidAgeScenario(),
                    ({ dateOfBirth, currentDate }) => {
                        const dobStr = formatDate(dateOfBirth);

                        // Should not throw
                        try {
                            validateAge(dobStr, currentDate);
                            return true;
                        } catch {
                            return false;
                        }
                    }
                ),
                { numRuns: 200 }
            );
        });

        it('should correctly handle birthday not yet reached in current year (still underage)', () => {
            fc.assert(
                fc.property(
                    generateBirthdayNotReachedUnderage(),
                    ({ dateOfBirth, currentDate }) => {
                        const dobStr = formatDate(dateOfBirth);

                        try {
                            validateAge(dobStr, currentDate);
                            return false; // Should have thrown
                        } catch (error) {
                            if (!(error instanceof ValidationError)) return false;
                            return error.code === ErrorCodes.INVALID_AGE;
                        }
                    }
                ),
                { numRuns: 200 }
            );
        });
    });

    /**
     * Property 4: Date of birth boundary rejection
     *
     * For any date of birth that is in the future relative to the current server date,
     * or that results in an age greater than 150 years, the system SHALL reject the request
     * with error code INVALID_DATE_OF_BIRTH.
     *
     *
     */
    describe('Property 4: Date of birth boundary rejection', () => {
        it('should reject with INVALID_DATE_OF_BIRTH when date of birth is in the future', () => {
            fc.assert(
                fc.property(
                    generateFutureDateScenario(),
                    ({ dateOfBirth, currentDate }) => {
                        const dobStr = formatDate(dateOfBirth);

                        try {
                            validateAge(dobStr, currentDate);
                            return false; // Should have thrown
                        } catch (error) {
                            if (!(error instanceof ValidationError)) return false;
                            return error.code === ErrorCodes.INVALID_DATE_OF_BIRTH;
                        }
                    }
                ),
                { numRuns: 200 }
            );
        });

        it('should reject with INVALID_DATE_OF_BIRTH when age > 150 years', () => {
            fc.assert(
                fc.property(
                    generateOver150Scenario(),
                    ({ dateOfBirth, currentDate }) => {
                        const dobStr = formatDate(dateOfBirth);

                        try {
                            validateAge(dobStr, currentDate);
                            return false; // Should have thrown
                        } catch (error) {
                            if (!(error instanceof ValidationError)) return false;
                            return error.code === ErrorCodes.INVALID_DATE_OF_BIRTH;
                        }
                    }
                ),
                { numRuns: 200 }
            );
        });
    });
});

// --- Helper Functions ---

function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// --- Shared Types ---

interface AgeScenario {
    dateOfBirth: Date;
    currentDate: Date;
}

// --- Reusable Building Blocks ---

/**
 * Generates a reference date constrained to day 1-28 to avoid month-overflow issues.
 */
function referenceDate(yearRange: { min: number; max: number } = { min: 2000, max: 2050 }): fc.Arbitrary<{ year: number; month: number; day: number }> {
    return fc.record({
        year: fc.integer(yearRange),
        month: fc.integer({ min: 0, max: 11 }),
        day: fc.integer({ min: 1, max: 28 }),
    });
}

/**
 * Generates a birth month/day that is ON or BEFORE the reference month/day.
 * This guarantees the birthday HAS occurred in the reference year.
 *
 * Strategy: use fc.oneof to split into two non-overlapping cases that don't need filtering:
 * - Birth month strictly before current month → any day is valid
 * - Birth month equals current month → birth day in [1, currentDay]
 */
function birthDayOnOrBefore(currentMonth: number, currentDay: number): fc.Arbitrary<{ birthMonth: number; birthDay: number }> {
    const samMonthCase = fc.record({
        birthMonth: fc.constant(currentMonth),
        birthDay: fc.integer({ min: 1, max: currentDay }),
    });

    if (currentMonth === 0) {
        // January: only the same-month case is possible
        return samMonthCase;
    }

    const earlierMonthCase = fc.record({
        birthMonth: fc.integer({ min: 0, max: currentMonth - 1 }),
        birthDay: fc.integer({ min: 1, max: 28 }),
    });

    return fc.oneof(earlierMonthCase, samMonthCase);
}

/**
 * Generates a birth month/day that is strictly AFTER the reference month/day.
 * This guarantees the birthday has NOT yet occurred in the reference year.
 *
 * Strategy: use fc.oneof to split into two non-overlapping cases:
 * - Birth month strictly after current month → any day is valid
 * - Birth month equals current month → birth day in [currentDay+1, 28]
 */
function birthDayStrictlyAfter(currentMonth: number, currentDay: number): fc.Arbitrary<{ birthMonth: number; birthDay: number }> {
    const laterMonthCase = (currentMonth < 11)
        ? fc.record({
            birthMonth: fc.integer({ min: currentMonth + 1, max: 11 }),
            birthDay: fc.integer({ min: 1, max: 28 }),
        })
        : null;

    const sameMonthLaterDayCase = (currentDay < 28)
        ? fc.record({
            birthMonth: fc.constant(currentMonth),
            birthDay: fc.integer({ min: currentDay + 1, max: 28 }),
        })
        : null;

    const cases = [laterMonthCase, sameMonthLaterDayCase].filter(
        (c): c is fc.Arbitrary<{ birthMonth: number; birthDay: number }> => c !== null
    );

    // At least one case is always valid when currentMonth <= 10 or currentDay < 28
    return cases.length === 1 ? cases[0]! : fc.oneof(...cases);
}

/**
 * Assembles the final scenario from components.
 */
function buildScenario(
    refYear: number,
    refMonth: number,
    refDay: number,
    birthYear: number,
    birthMonth: number,
    birthDay: number
): AgeScenario {
    return {
        dateOfBirth: new Date(birthYear, birthMonth, birthDay),
        currentDate: new Date(refYear, refMonth, refDay),
    };
}

// --- Public Generators ---

/**
 * Generates a scenario where the person has 0-17 complete years.
 * Uses fc.oneof to cover both sub-cases without any filter():
 * - Birthday reached this year → complete years = calendarDiff, so calendarDiff in [0, 17]
 * - Birthday NOT reached → complete years = calendarDiff - 1, so calendarDiff in [1, 18]
 */
function generateUnderageScenario(): fc.Arbitrary<AgeScenario> {
    return fc.oneof(
        // Case A: birthday reached, complete years = calendarDiff ∈ [0, MINIMUM_AGE - 1]
        referenceDate()
            .chain(({ year, month, day }) =>
                fc.tuple(
                    fc.integer({ min: 0, max: CustumerAgeRules.MINIMUM_AGE - 1 }),
                    birthDayOnOrBefore(month, day)
                ).map(([age, { birthMonth, birthDay }]) =>
                    buildScenario(year, month, day, year - age, birthMonth, birthDay)
                )
            ),
        // Case B: birthday not reached, complete years = calendarDiff - 1 ∈ [0, MINIMUM_AGE - 1]
        // So calendarDiff ∈ [1, MINIMUM_AGE]. We constrain currentMonth <= 10 to guarantee
        // there's always a valid later month for birthDayStrictlyAfter.
        fc.record({
            year: fc.integer({ min: 2000, max: 2050 }),
            month: fc.integer({ min: 0, max: 10 }),
            day: fc.integer({ min: 1, max: 28 }),
            calendarDiff: fc.integer({ min: 1, max: CustumerAgeRules.MINIMUM_AGE }),
        }).chain(({ year, month, day, calendarDiff }) =>
            birthDayStrictlyAfter(month, day)
                .map(({ birthMonth, birthDay }) =>
                    buildScenario(year, month, day, year - calendarDiff, birthMonth, birthDay)
                )
        )
    );
}

/**
 * Generates a scenario with 18-150 complete years.
 * Delegates to two sub-generators via fc.oneof — no filter needed.
 */
function generateValidAgeScenario(): fc.Arbitrary<AgeScenario> {
    return fc.oneof(
        generateWithBirthdayReached({ min: CustumerAgeRules.MINIMUM_AGE, max: CustumerAgeRules.MAXIMUM_AGE }),
        generateWithBirthdayNotReached({ min: CustumerAgeRules.MINIMUM_AGE, max: CustumerAgeRules.MAXIMUM_AGE - 1 })
    );
}

/**
 * Birthday already reached → complete years = currentYear - birthYear = ageYears.
 */
function generateWithBirthdayReached(ageRange: { min: number; max: number }): fc.Arbitrary<AgeScenario> {
    return referenceDate()
        .chain(({ year, month, day }) =>
            fc.tuple(
                fc.integer(ageRange),
                birthDayOnOrBefore(month, day)
            ).map(([age, { birthMonth, birthDay }]) =>
                buildScenario(year, month, day, year - age, birthMonth, birthDay)
            )
        );
}

/**
 * Birthday NOT yet reached → complete years = calendarDiff - 1 = ageYears,
 * so birthYear = currentYear - ageYears - 1.
 * Constrains currentMonth ≤ 10 to ensure birthDayStrictlyAfter always has valid output.
 */
function generateWithBirthdayNotReached(ageRange: { min: number; max: number }): fc.Arbitrary<AgeScenario> {
    return fc.record({
        year: fc.integer({ min: 2000, max: 2050 }),
        month: fc.integer({ min: 0, max: 10 }),
        day: fc.integer({ min: 1, max: 28 }),
        age: fc.integer(ageRange),
    }).chain(({ year, month, day, age }) =>
        birthDayStrictlyAfter(month, day)
            .map(({ birthMonth, birthDay }) =>
                buildScenario(year, month, day, year - age - 1, birthMonth, birthDay)
            )
    );
}

/**
 * Generates a scenario where 18 calendar years have passed but the birthday
 * hasn't occurred yet → complete years = 17 (still underage).
 */
function generateBirthdayNotReachedUnderage(): fc.Arbitrary<AgeScenario> {
    return fc.record({
        year: fc.integer({ min: 2020, max: 2050 }),
        month: fc.integer({ min: 0, max: 10 }),
        day: fc.integer({ min: 1, max: 28 }),
    }).chain(({ year, month, day }) =>
        birthDayStrictlyAfter(month, day)
            .map(({ birthMonth, birthDay }) =>
                buildScenario(year, month, day, year - CustumerAgeRules.MINIMUM_AGE, birthMonth, birthDay)
            )
    );
}

/**
 * Generates a date of birth in the future relative to the reference date.
 * Uses additive offset — always valid, no filter needed.
 */
function generateFutureDateScenario(): fc.Arbitrary<AgeScenario> {
    return fc.record({
        year: fc.integer({ min: 2000, max: 2050 }),
        month: fc.integer({ min: 0, max: 11 }),
        day: fc.integer({ min: 1, max: 28 }),
        daysInFuture: fc.integer({ min: 1, max: 3650 }),
    }).map(({ year, month, day, daysInFuture }) => {
        const currentDate = new Date(year, month, day);
        const futureDate = new Date(currentDate.getTime() + daysInFuture * 24 * 60 * 60 * 1000);
        return { dateOfBirth: futureDate, currentDate };
    });
}

/**
 * Generates a scenario where age > 150 complete years.
 * Uses birthday-reached strategy with ageRange [151, 300] — always valid, no filter needed.
 */
function generateOver150Scenario(): fc.Arbitrary<AgeScenario> {
    return generateWithBirthdayReached({ min: CustumerAgeRules.MAXIMUM_AGE + 1, max: CustumerAgeRules.MAXIMUM_AGE * 2 });
}
