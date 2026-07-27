/**
 * Possible statuses for a bank account.
 */
export const AccountStatus = {
    ACTIVE: "ACTIVE",
    INACTIVE: "INACTIVE",
    CLOSED: "CLOSED",
} as const;

export type AccountStatusType = typeof AccountStatus[keyof typeof AccountStatus];

/**
 * Account amount limits.
 */

export const AccountRules= {
    MIN_INITIAL_AMOUNT: 0,
    MAX_INITIAL_AMOUNT: 999999999.99,
    MAX_DECIMALS: 2,
} as const;


