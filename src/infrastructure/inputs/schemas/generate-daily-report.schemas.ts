import { z } from 'zod';

export const GenerateDailyReportEventSchema = z.object({
    source: z.string().min(1).max(256),
    'detail-type': z.string().min(1).max(256),
    detail: z.object({}).passthrough(),
});

export type GenerateDailyReportEvent = z.infer<typeof GenerateDailyReportEventSchema>;
