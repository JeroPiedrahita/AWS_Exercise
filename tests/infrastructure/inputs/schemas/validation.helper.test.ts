import { z } from 'zod';
import {
    validateSchema,
    buildValidationErrorResponse,
    validateResponse,
} from '@/infrastructure/inputs/schemas/validation.helper';

describe('validateSchema', () => {
    const testSchema = z.object({
        name: z.string().min(1),
        age: z.number().int().positive(),
    });

    it('should return success with validated data when input is valid', () => {
        const input = { name: 'John', age: 30 };

        const result = validateSchema(testSchema, input);

        expect(result.success).toBe(true);
        expect(result).toEqual({ success: true, data: { name: 'John', age: 30 } });
    });

    it('should return failure with field path in error when a single field is invalid', () => {
        const input = { name: '', age: 30 };

        const result = validateSchema(testSchema, input);

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toContain('name');
        }
    });

    it('should return failure with all field paths when multiple fields are invalid', () => {
        const input = { name: '', age: -5 };

        const result = validateSchema(testSchema, input);

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toContain('name');
            expect(result.error).toContain('age');
        }
    });

    it('should aggregate multiple errors using ", " separator', () => {
        const input = { name: '', age: -5 };

        const result = validateSchema(testSchema, input);

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toContain(', ');
        }
    });

    it('should include field path with dot notation for nested objects', () => {
        const nestedSchema = z.object({
            address: z.object({
                street: z.string().min(1),
            }),
        });
        const input = { address: { street: '' } };

        const result = validateSchema(nestedSchema, input);

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toContain('address.street');
        }
    });
});

describe('buildValidationErrorResponse', () => {
    it('should return HTTP 400 status code', () => {
        const response = buildValidationErrorResponse('Some error');

        expect(response.statusCode).toBe(400);
    });

    it('should return body with success false, data null, and error message', () => {
        const errorMessage = 'id: String must contain at least 1 character(s)';

        const response = buildValidationErrorResponse(errorMessage);

        const body = JSON.parse(response.body);
        expect(body).toEqual({
            success: false,
            data: null,
            error: errorMessage,
        });
    });

    it('should return a JSON-stringified body', () => {
        const response = buildValidationErrorResponse('test error');

        expect(() => JSON.parse(response.body)).not.toThrow();
    });
});

describe('validateResponse', () => {
    const responseSchema = z.object({
        id: z.string().min(1),
        status: z.string(),
    });

    it('should return validated data when input is valid', () => {
        const input = { id: 'txn-001', status: 'COMPLETED' };

        const result = validateResponse(responseSchema, input);

        expect(result).toEqual({ id: 'txn-001', status: 'COMPLETED' });
    });

    it('should throw Error with "Response contract violation" when validation fails', () => {
        const input = { id: '', status: 'COMPLETED' };

        expect(() => validateResponse(responseSchema, input)).toThrow('Response contract violation');
    });

    it('should include the failing field path in the error message', () => {
        const input = { id: '', status: 'COMPLETED' };

        expect(() => validateResponse(responseSchema, input)).toThrow('id');
    });

    it('should throw an instance of Error', () => {
        const input = { id: '', status: 123 };

        expect(() => validateResponse(responseSchema, input)).toThrowError(Error);
    });

    it('should aggregate multiple field errors with ", " separator when multiple fields fail', () => {
        const input = { id: '', status: 123 };

        try {
            validateResponse(responseSchema, input);
            fail('Expected an error to be thrown');
        } catch (error) {
            const message = (error as Error).message;
            expect(message).toContain('Response contract violation');
            expect(message).toContain('id');
            expect(message).toContain(', ');
        }
    });
});
