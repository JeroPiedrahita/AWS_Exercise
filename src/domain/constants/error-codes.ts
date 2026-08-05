/**
 * Domain error codes for customer account creation validation and processing.
 */
export const ErrorCodes = {
    INVALID_REQUEST_FORMAT: "INVALID_REQUEST_FORMAT",
    MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",
    INVALID_AGE: "INVALID_AGE",
    INVALID_DATE_OF_BIRTH: "INVALID_DATE_OF_BIRTH",
    INVALID_INITIAL_AMOUNT: "INVALID_INITIAL_AMOUNT",
    INVALID_EMAIL_FORMAT: "INVALID_EMAIL_FORMAT",
    ACCOUNT_ALREADY_EXISTS: "ACCOUNT_ALREADY_EXISTS",
    INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
} as const;

export type ErrorCodeType = typeof ErrorCodes[keyof typeof ErrorCodes];
