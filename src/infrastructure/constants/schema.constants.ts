/**
 * Schema validation length limits for infrastructure input validation.
 */
export const SchemaLimits = {
    /** Maximum length for UUID-based identifiers (id, accountId) */
    MAX_UUID_LENGTH: 36,
    /** Maximum length for transaction path parameter id */
    MAX_TRANSACTION_ID_LENGTH: 128,
    /** Maximum length for EventBridge event fields (source, detail-type) */
    MAX_EVENT_FIELD_LENGTH: 256,
} as const;
