import { ReportExporter } from '@/domain/ports/report-exporter';

export function createMockReportExporter(): jest.Mocked<ReportExporter> {
    return {
        export: jest.fn(),
    };
}
