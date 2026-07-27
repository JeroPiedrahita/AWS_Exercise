import { z } from 'zod';
import { SchemaLimits } from '../../constants/schema.constants';

export const GenerateDailyReportEventSchema = z.object({
    source: z.string().min(1).max(SchemaLimits.MAX_EVENT_FIELD_LENGTH),
    'detail-type': z.string().min(1).max(SchemaLimits.MAX_EVENT_FIELD_LENGTH),
    detail: z.object({}).passthrough(),
});

export type GenerateDailyReportEvent = z.infer<typeof GenerateDailyReportEventSchema>;
