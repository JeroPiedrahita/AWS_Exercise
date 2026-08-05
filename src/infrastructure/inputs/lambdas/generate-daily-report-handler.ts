import { GenerateDailyReportUseCase } from '../../../application/generate-daily-report.use-case';
import { DynamonDBTransactionAdapter } from '../../outputs/dynamondb-transaction-adapter';
import { ExcelReportExporter } from '../../outputs/excel-report-exporter';
import { S3FileStorage } from '../../outputs/s3filestorage';
import { BaseError } from '../../../domain/exceptions/base.error';
import { GenerateDailyReportEventSchema } from '../schemas/generate-daily-report.schemas';
import { validateSchema, buildValidationErrorResponse } from '../schemas/validation.helper';
import { HTTP_STATUS } from '@/infrastructure/constants/http-response';

export const handler = async (event: unknown): Promise<any> => {
    try {
        if (!event) {
            return buildValidationErrorResponse('El evento es requerido.');
        }

        const validation = validateSchema(GenerateDailyReportEventSchema, event);
        if (!validation.success) {
            return buildValidationErrorResponse(validation.error);
        }

        const repository = new DynamonDBTransactionAdapter();
        const reportExporter = new ExcelReportExporter();
        const fileStorage = new S3FileStorage();

        const useCase = new GenerateDailyReportUseCase(
            repository,
            reportExporter,
            fileStorage
        );

        await useCase.execute();

        return {
            statusCode: HTTP_STATUS.OK,
            body: JSON.stringify({
                message: 'Reporte diario generado correctamente',
            }),
        };
    } catch (error) {
        if (error instanceof BaseError) {
            console.error(error);
            return {
                statusCode: HTTP_STATUS.BAD_REQUEST,
                body: JSON.stringify({ error: error.userMessage }),
            };
        }

        console.error(error);
        return {
            statusCode: HTTP_STATUS.INTERNAL_ERROR,
            body: JSON.stringify({ error: 'Error al generar el reporte diario' }),
        };
    }
};
