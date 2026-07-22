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

    it('should return 400 with validation error format when event is null', async () => {
        const result = await handler(null as unknown as EventBridgeEvent<string, any>);

        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body)).toEqual({
            success: false,
            data: null,
            error: 'El evento es requerido.',
        });
    });

    it('should return 400 with validation error format when event is undefined', async () => {
        const result = await handler(undefined as unknown as EventBridgeEvent<string, any>);

        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body)).toEqual({
            success: false,
            data: null,
            error: 'El evento es requerido.',
        });
    });

    it('should return 400 with validation error format when source is missing', async () => {
        const invalidEvent = {
            'detail-type': 'Scheduled Event',
            detail: {},
        } as unknown as EventBridgeEvent<string, any>;

        const result = await handler(invalidEvent);

        expect(result.statusCode).toBe(400);
        const body = JSON.parse(result.body);
        expect(body.success).toBe(false);
        expect(body.data).toBeNull();
        expect(body.error).toBeDefined();
        expect(body.error).toContain('source');
    });

    it('should return 400 with validation error format when detail-type is missing', async () => {
        const invalidEvent = {
            source: 'aws.events',
            detail: {},
        } as unknown as EventBridgeEvent<string, any>;

        const result = await handler(invalidEvent);

        expect(result.statusCode).toBe(400);
        const body = JSON.parse(result.body);
        expect(body.success).toBe(false);
        expect(body.data).toBeNull();
        expect(body.error).toBeDefined();
        expect(body.error).toContain('detail-type');
    });

    it('should return 400 with validation error format when detail is missing', async () => {
        const invalidEvent = {
            source: 'aws.events',
            'detail-type': 'Scheduled Event',
        } as unknown as EventBridgeEvent<string, any>;

        const result = await handler(invalidEvent);

        expect(result.statusCode).toBe(400);
        const body = JSON.parse(result.body);
        expect(body.success).toBe(false);
        expect(body.data).toBeNull();
        expect(body.error).toBeDefined();
        expect(body.error).toContain('detail');
    });

    it('should return 200 with success message on successful execution', async () => {
        const result = await handler(mockEvent);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual({
            message: 'Reporte diario generado correctamente',
        });
    });

    it('should return 400 with domain error format when a BaseError is thrown', async () => {
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

    it('should return 500 with domain error format when an unhandled error is thrown', async () => {
        MockedGenerateDailyReportUseCase.prototype.execute = jest.fn().mockRejectedValue(new Error('Unexpected failure'));

        const result = await handler(mockEvent);

        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body)).toEqual({
            error: 'Error al generar el reporte diario',
        });
    });
});
