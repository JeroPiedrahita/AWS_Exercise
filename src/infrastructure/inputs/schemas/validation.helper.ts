import { type ZodType } from 'zod';
import { type APIGatewayProxyResult } from 'aws-lambda';

export interface ValidationSuccess<T> {
    success: true;
    data: T;
}

export interface ValidationFailure {
    success: false;
    error: string;
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

/**
 * Validates data against a Zod schema using safeParse.
 * Returns a discriminated union result.
 * @param schema - The Zod schema to validate against
 * @param data - The unknown data to validate
 * @returns A ValidationResult with typed data on success or error string on failure
 */
export function validateSchema<T>(schema: ZodType<T>, data: unknown): ValidationResult<T> {
    const result = schema.safeParse(data);

    if (result.success) {
        return { success: true, data: result.data };
    }

    const errorMessages = result.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`
    );

    return {
        success: false,
        error: errorMessages.join(', '),
    };
}

/**
 * Builds a standardized validation error response for API Gateway.
 * @param errorMessage - The validation error message to include in the response
 * @returns An APIGatewayProxyResult with HTTP 400 status and error body
 */
export function buildValidationErrorResponse(errorMessage: string): APIGatewayProxyResult {
    return {
        statusCode: 400,
        body: JSON.stringify({
            success: false,
            data: null,
            error: errorMessage,
        }),
    };
}

/**
 * Validates response data against a schema.
 * Throws on failure to prevent contract violations.
 * @param schema - The Zod schema to validate the response against
 * @param data - The response data to validate
 * @returns The validated and typed response data
 * @throws Error with "Response contract violation" message when validation fails
 */
export function validateResponse<T>(schema: ZodType<T>, data: unknown): T {
    const result = schema.safeParse(data);

    if (!result.success) {
        const errorMessages = result.error.issues.map(
            (issue) => `${issue.path.join('.')}: ${issue.message}`
        );
        throw new Error(`Response contract violation: ${errorMessages.join(', ')}`);
    }

    return result.data;
}
