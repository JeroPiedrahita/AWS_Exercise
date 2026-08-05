import fc from 'fast-check';
import { validateEmail } from '@/domain/validators/email.validator';
import { ValidationError } from '@/domain/exceptions/validation.error';
import { ErrorCodes } from '@/domain/constants/error-codes';

/**
 * Property-based tests for email validator.
 *
 * Property 7: Email format validation
 * Validates: Requirements 6.1, 6.2
 */
describe('validateEmail - Property Tests', () => {
    /**
     * Property 7: Email format validation
     *
     * For any string that does not contain exactly one "@" character, or where the
     * local part (before "@") is empty, or where the domain part (after "@") is empty
     * or does not contain at least one "." character, the system SHALL reject the request
     * with error code INVALID_EMAIL_FORMAT. Conversely, for any string with exactly one
     * "@", non-empty local part, and a domain containing at least one ".", validation
     * SHALL pass.
     */
    describe('Property 7: Email format validation', () => {
        it('should reject with INVALID_EMAIL_FORMAT when email has no "@" character', () => {
            fc.assert(
                fc.property(
                    emailWithNoAt(),
                    (email) => {
                        try {
                            validateEmail(email);
                            return false; // Should have thrown
                        } catch (error) {
                            if (!(error instanceof ValidationError)) return false;
                            return error.code === ErrorCodes.INVALID_EMAIL_FORMAT;
                        }
                    }
                ),
                { numRuns: 200 }
            );
        });

        it('should reject with INVALID_EMAIL_FORMAT when email has multiple "@" characters', () => {
            fc.assert(
                fc.property(
                    emailWithMultipleAt(),
                    (email) => {
                        try {
                            validateEmail(email);
                            return false; // Should have thrown
                        } catch (error) {
                            if (!(error instanceof ValidationError)) return false;
                            return error.code === ErrorCodes.INVALID_EMAIL_FORMAT;
                        }
                    }
                ),
                { numRuns: 200 }
            );
        });

        it('should reject with INVALID_EMAIL_FORMAT when local part (before "@") is empty', () => {
            fc.assert(
                fc.property(
                    emailWithEmptyLocalPart(),
                    (email) => {
                        try {
                            validateEmail(email);
                            return false; // Should have thrown
                        } catch (error) {
                            if (!(error instanceof ValidationError)) return false;
                            return error.code === ErrorCodes.INVALID_EMAIL_FORMAT;
                        }
                    }
                ),
                { numRuns: 200 }
            );
        });

        it('should reject with INVALID_EMAIL_FORMAT when domain part (after "@") is empty', () => {
            fc.assert(
                fc.property(
                    emailWithEmptyDomain(),
                    (email) => {
                        try {
                            validateEmail(email);
                            return false; // Should have thrown
                        } catch (error) {
                            if (!(error instanceof ValidationError)) return false;
                            return error.code === ErrorCodes.INVALID_EMAIL_FORMAT;
                        }
                    }
                ),
                { numRuns: 200 }
            );
        });

        it('should reject with INVALID_EMAIL_FORMAT when domain part does not contain "."', () => {
            fc.assert(
                fc.property(
                    emailWithDomainWithoutDot(),
                    (email) => {
                        try {
                            validateEmail(email);
                            return false; // Should have thrown
                        } catch (error) {
                            if (!(error instanceof ValidationError)) return false;
                            return error.code === ErrorCodes.INVALID_EMAIL_FORMAT;
                        }
                    }
                ),
                { numRuns: 200 }
            );
        });

        it('should pass validation when email has exactly one "@", non-empty local part, and domain with at least one "."', () => {
            fc.assert(
                fc.property(
                    validEmail(),
                    (email) => {
                        try {
                            validateEmail(email);
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
 * Generates a non-empty alphanumeric string that does not contain "@".
 */
function nonAtString(minLength = 1, maxLength = 20): fc.Arbitrary<string> {
    return fc.string({ minLength, maxLength }).filter((s) => !s.includes('@') && s.length >= minLength);
}

/**
 * Generates a non-empty alphanumeric string that does not contain "@" or ".".
 */
function nonAtDotString(minLength = 1, maxLength = 15): fc.Arbitrary<string> {
    return fc.string({ minLength, maxLength }).filter((s) => !s.includes('@') && !s.includes('.') && s.length >= minLength);
}

/**
 * Generates a non-empty string without any "@" character.
 * These strings will fail the "exactly one @" validation rule.
 */
function emailWithNoAt(): fc.Arbitrary<string> {
    return nonAtString(1, 50);
}

/**
 * Generates a string with 2 or more "@" characters.
 * Strategy: construct segments without "@" and join them with "@".
 */
function emailWithMultipleAt(): fc.Arbitrary<string> {
    return fc.integer({ min: 3, max: 5 }).chain((segmentCount) =>
        fc.array(
            nonAtString(1, 10),
            { minLength: segmentCount, maxLength: segmentCount }
        ).map((segments) => segments.join('@'))
    );
}

/**
 * Generates an email string with an empty local part (starts with "@").
 * Format: "@<domain>" where domain is a non-empty string without "@".
 */
function emailWithEmptyLocalPart(): fc.Arbitrary<string> {
    return nonAtString(1, 30).map((domain) => `@${domain}`);
}

/**
 * Generates an email string with an empty domain part (ends with "@").
 * Format: "<local>@" where local is a non-empty string without "@".
 */
function emailWithEmptyDomain(): fc.Arbitrary<string> {
    return nonAtString(1, 30).map((local) => `${local}@`);
}

/**
 * Generates an email string where the domain part does not contain ".".
 * Format: "<local>@<domain>" where local is non-empty (no "@"),
 * domain is non-empty and contains no "@" or "." characters.
 */
function emailWithDomainWithoutDot(): fc.Arbitrary<string> {
    return fc.record({
        local: nonAtString(1, 20),
        domain: nonAtDotString(1, 20),
    }).map(({ local, domain }) => `${local}@${domain}`);
}

/**
 * Generates a valid email: exactly one "@", non-empty local part,
 * and domain containing at least one ".".
 * Format: "<local>@<domainLabel>.<tld>"
 */
function validEmail(): fc.Arbitrary<string> {
    return fc.record({
        local: nonAtString(1, 20),
        domainLabel: nonAtDotString(1, 15),
        tld: nonAtDotString(1, 6),
    }).map(({ local, domainLabel, tld }) => `${local}@${domainLabel}.${tld}`);
}
