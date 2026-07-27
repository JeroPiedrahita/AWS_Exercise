import { GenerateDailyReportEventSchema } from '@/infrastructure/inputs/schemas/generate-daily-report.schemas';
import { SchemaLimits } from '@/infrastructure/constants/schema.constants';

describe('GenerateDailyReportEventSchema', () => {
    const validEvent = {
        source: 'aws.events',
        'detail-type': 'Scheduled Event',
        detail: {},
    };

    describe('valid inputs', () => {
        it('should accept a valid event', () => {
            const result = GenerateDailyReportEventSchema.safeParse(validEvent);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toEqual(validEvent);
            }
        });

        it('should accept source at max length of 256 characters', () => {
            const input = { ...validEvent, source: 'a'.repeat(SchemaLimits.MAX_EVENT_FIELD_LENGTH) };

            const result = GenerateDailyReportEventSchema.safeParse(input);

            expect(result.success).toBe(true);
        });

        it('should accept detail-type at max length of 256 characters', () => {
            const input = { ...validEvent, 'detail-type': 'b'.repeat(SchemaLimits.MAX_EVENT_FIELD_LENGTH) };

            const result = GenerateDailyReportEventSchema.safeParse(input);

            expect(result.success).toBe(true);
        });

        it('should accept detail with additional properties (passthrough)', () => {
            const input = {
                ...validEvent,
                detail: { reportDate: '2024-01-15', region: 'us-east-1' },
            };

            const result = GenerateDailyReportEventSchema.safeParse(input);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.detail).toEqual({ reportDate: '2024-01-15', region: 'us-east-1' });
            }
        });
    });

    describe('source field validation', () => {
        it('should reject missing source', () => {
            const { source, ...input } = validEvent;

            const result = GenerateDailyReportEventSchema.safeParse(input);

            expect(result.success).toBe(false);
        });

        it('should reject empty source', () => {
            const input = { ...validEvent, source: '' };

            const result = GenerateDailyReportEventSchema.safeParse(input);

            expect(result.success).toBe(false);
        });

        it('should reject source exceeding 256 characters', () => {
            const input = { ...validEvent, source: 'a'.repeat(SchemaLimits.MAX_EVENT_FIELD_LENGTH + 1) };

            const result = GenerateDailyReportEventSchema.safeParse(input);

            expect(result.success).toBe(false);
        });
    });

    describe('detail-type field validation', () => {
        it('should reject missing detail-type', () => {
            const { 'detail-type': _, ...input } = validEvent;

            const result = GenerateDailyReportEventSchema.safeParse(input);

            expect(result.success).toBe(false);
        });

        it('should reject empty detail-type', () => {
            const input = { ...validEvent, 'detail-type': '' };

            const result = GenerateDailyReportEventSchema.safeParse(input);

            expect(result.success).toBe(false);
        });

        it('should reject detail-type exceeding 256 characters', () => {
            const input = { ...validEvent, 'detail-type': 'b'.repeat(SchemaLimits.MAX_EVENT_FIELD_LENGTH + 1) };

            const result = GenerateDailyReportEventSchema.safeParse(input);

            expect(result.success).toBe(false);
        });
    });

    describe('detail field validation', () => {
        it('should reject null detail', () => {
            const input = { ...validEvent, detail: null };

            const result = GenerateDailyReportEventSchema.safeParse(input);

            expect(result.success).toBe(false);
        });

        it('should reject missing detail', () => {
            const { detail, ...input } = validEvent;

            const result = GenerateDailyReportEventSchema.safeParse(input);

            expect(result.success).toBe(false);
        });

        it('should accept empty object as detail', () => {
            const input = { ...validEvent, detail: {} };

            const result = GenerateDailyReportEventSchema.safeParse(input);

            expect(result.success).toBe(true);
        });
    });
});
