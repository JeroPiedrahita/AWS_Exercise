export const HTTP_STATUS={
    OK: 200,
    CREATED: 201,
    INTERNAL_ERROR: 500,
    BAD_REQUEST: 400,
    CONFLICT_ERROR: 409,
    TRANSACTION_NOT_FOUND:404,
} as const;

export type HttpStatusKey = keyof typeof HTTP_STATUS;
export type HttpStatusCode = typeof HTTP_STATUS[HttpStatusKey];

