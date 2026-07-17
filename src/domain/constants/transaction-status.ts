
export const TransactionStatus = {
    PENDING: "PENDING",
    COMPLETED: "COMPLETED",
    FAILED: "FAILED"
} as const;
export type TransactionStatusType =
typeof TransactionStatus[keyof typeof TransactionStatus];