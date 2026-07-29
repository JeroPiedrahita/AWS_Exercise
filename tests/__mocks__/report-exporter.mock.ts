import { ReportExporter } from '@/application/ports/report-exporter';

export function createMockReportExporter(): jest.Mocked<ReportExporter> {
    return {
        export: jest.fn(),
    };
}
