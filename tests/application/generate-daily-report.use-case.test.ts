import { GenerateDailyReportUseCase } from '@/application/generate-daily-report.use-case';
import { ITransactionRepository } from '@/domain/ports/transaction-repository';
import { ReportExporter } from '@/application/ports/report-exporter';
import { FileStorage } from '@/domain/ports/file-storage';
import { createMockTransactionRepository } from '../__mocks__/transaction-repository.mock';
import { createMockReportExporter } from '../__mocks__/report-exporter.mock';
import { createMockFileStorage } from '../__mocks__/file-storage.mock';
import { createTransactionList } from '../fixtures/transaction.fixtures';

describe('GenerateDailyReportUseCase', () => {
    let useCase: GenerateDailyReportUseCase;
    let mockRepository: jest.Mocked<ITransactionRepository>;
    let mockReportExporter: jest.Mocked<ReportExporter>;
    let mockFileStorage: jest.Mocked<FileStorage>;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2024-03-15T14:30:00.000Z'));

        mockRepository = createMockTransactionRepository();
        mockReportExporter = createMockReportExporter();
        mockFileStorage = createMockFileStorage();

        mockRepository.getTransactionsBetweenDates.mockResolvedValue([]);
        mockReportExporter.export.mockResolvedValue(Buffer.from(''));

        useCase = new GenerateDailyReportUseCase(
            mockRepository,
            mockReportExporter,
            mockFileStorage
        );
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should call repository.getTransactionsBetweenDates with start-of-day (00:00:00.000) and end-of-day (23:59:59.999) dates', async () => {
        await useCase.execute();

        expect(mockRepository.getTransactionsBetweenDates).toHaveBeenCalledTimes(1);

        const [startDate, endDate] = mockRepository.getTransactionsBetweenDates.mock.calls[0]!;

        expect(startDate.getHours()).toBe(0);
        expect(startDate.getMinutes()).toBe(0);
        expect(startDate.getSeconds()).toBe(0);
        expect(startDate.getMilliseconds()).toBe(0);

        expect(endDate.getHours()).toBe(23);
        expect(endDate.getMinutes()).toBe(59);
        expect(endDate.getSeconds()).toBe(59);
        expect(endDate.getMilliseconds()).toBe(999);
    });

    it('should call reportExporter.export with the transactions returned by the repository', async () => {
        const transactions = createTransactionList(3);
        mockRepository.getTransactionsBetweenDates.mockResolvedValue(transactions);

        await useCase.execute();

        expect(mockReportExporter.export).toHaveBeenCalledTimes(1);
        expect(mockReportExporter.export).toHaveBeenCalledWith(transactions);
    });

    it('should call fileStorage.save with filename matching pattern "reporte-YYYY-MM-DD.xlsx" and the Buffer from reportExporter', async () => {
        const reportBuffer = Buffer.from('fake-report-content');
        mockReportExporter.export.mockResolvedValue(reportBuffer);

        await useCase.execute();

        expect(mockFileStorage.save).toHaveBeenCalledTimes(1);
        expect(mockFileStorage.save).toHaveBeenCalledWith(
            'reporte-2024-03-15.xlsx',
            reportBuffer
        );
    });
});
