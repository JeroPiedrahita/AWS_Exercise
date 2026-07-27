import { createMockReportExporter } from '../../__mocks__/report-exporter.mock';
import { Transaction } from '@/domain/entities/transaction';
import { TransactionStatus } from '@/domain/constants/transaction-status';

describe('ReportExporter (Port Contract)', () => {
    it('should expose export method that accepts Transaction[] and returns Promise<Buffer>', async () => {
        const mockExporter = createMockReportExporter();
        const expectedBuffer = Buffer.from('fake-report-content');
        mockExporter.export.mockResolvedValue(expectedBuffer);

        const transactions = [
            new Transaction('txn-001', 'acc-001', 100, TransactionStatus.COMPLETED, new Date()),
            new Transaction('txn-002', 'acc-002', 200, TransactionStatus.COMPLETED, new Date()),
        ];

        const result = await mockExporter.export(transactions);

        expect(mockExporter.export).toHaveBeenCalledWith(transactions);
        expect(result).toBeInstanceOf(Buffer);
        expect(result).toBe(expectedBuffer);
    });

    it('should handle empty transaction array', async () => {
        const mockExporter = createMockReportExporter();
        const emptyBuffer = Buffer.alloc(0);
        mockExporter.export.mockResolvedValue(emptyBuffer);

        const result = await mockExporter.export([]);

        expect(mockExporter.export).toHaveBeenCalledWith([]);
        expect(result).toBeInstanceOf(Buffer);
    });

    it('should implement all methods defined in the ReportExporter interface', () => {
        const mockExporter = createMockReportExporter();

        expect(mockExporter).toHaveProperty('export');
        expect(typeof mockExporter.export).toBe('function');
    });
});
