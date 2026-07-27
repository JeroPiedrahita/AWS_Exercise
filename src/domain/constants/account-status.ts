/**
 * Possible statuses for a bank account.
 */
export const AccountStatus = {
    ACTIVE: "ACTIVE",
    INACTIVE: "INACTIVE",
    CLOSED: "CLOSED",
} as const;

export type AccountStatusType = typeof AccountStatus[keyof typeof AccountStatus];
