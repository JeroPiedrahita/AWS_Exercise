import { handler } from '@/infrastructure/inputs/lambdas/generate-daily-report.handler';
import { GenerateDailyReportUseCase } from '@/application/generate-daily-report.use-case';
import { BaseError } from '@/domain/exceptions/base.error';
import { EventBridgeEvent } from 'aws-lambda';

jest.mock('@/infrastructure/outputs/dynamondb-transaction-adapter');
jest.mock('@/infrastructure/outputs/excel-report-exporter');
jest.mock('@/infrastructure/outputs/s3filestorage');
jest.mock('@/application/generate-daily-report.use-case');

const MockedGenerateDailyReportUseCase = GenerateDailyReportUseCase as jest.MockedClass<typeof GenerateDailyReportUseCase>;

describe('generate-daily-report.handler', () => {
    const mockEvent = {
        version: '0',
        id: 'test-id',
        source: 'aws.events',
        account: '123456789012',
        time: '2024-03-15T14:00:00Z',
        region: 'us-east-1',
        resources: [],
        'detail-type': 'Scheduled Event',
        detail: {},
    } as unknown as EventBridgeEvent<string, any>;

    beforeEach(() => {
        jest.clearAllMocks();
        MockedGenerateDailyReportUseCase.prototype.execute = jest.fn().mockResolvedValue(undefined);
    });

    it('should return 400 when event is null or undefined', async () => {
        const result = await handler(null as unknown as EventBridgeEvent<string, any>);

        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body)).toEqual({
            error: 'El evento recibido es inválido.',
        });
    });

    it('should return 200 with success message on successful execution', async () => {
        const result = await handler(mockEvent);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual({
            message: 'Reporte diario generado correctamente',
        });
    });

    it('should return 400 when a BaseError is thrown', async () => {
        class TestBaseError extends BaseError {
            constructor() {
                super('Internal error message', 'User-facing error message');
            }
        }

        MockedGenerateDailyReportUseCase.prototype.execute = jest.fn().mockRejectedValue(new TestBaseError());

        const result = await handler(mockEvent);

        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body)).toEqual({
            error: 'User-facing error message',
        });
    });

    it('should return 500 when an unhandled error is thrown', async () => {
        MockedGenerateDailyReportUseCase.prototype.execute = jest.fn().mockRejectedValue(new Error('Unexpected failure'));

        const result = await handler(mockEvent);

        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body)).toEqual({
            error: 'Error al generar el reporte diario',
        });
    });
});
