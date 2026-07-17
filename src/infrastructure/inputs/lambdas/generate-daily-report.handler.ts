import { GenerateDailyReportUseCase } from "../../../application/generate-daily-report.use-case";
import { DynamonDBTransactionAdapter } from "../../outputs/dynamondb-transaction-adapter";
import { ExcelReportExporter } from "../../outputs/excel-report-exporter";
import { S3FileStorage } from "../../outputs/s3filestorage";
import { BaseError } from "../../../domain/exceptions/base.error";
import {EventBridgeEvent} from "aws-lambda";
import { InvalidEventError } from "../../../domain/exceptions/invalid-event.error";

export const handler = async (event: EventBridgeEvent<string, any>): Promise<any> => {
    try {
        if(!event){
            throw new InvalidEventError(
                "The EventBridge event is underfined.",
                "El evento recibido es inválido."
            );
        }

        const repository =
            new DynamonDBTransactionAdapter();

        const reportExporter =
            new ExcelReportExporter();

        const fileStorage =
            new S3FileStorage();

        const useCase =
            new GenerateDailyReportUseCase(
                repository,
                reportExporter,
                fileStorage
            );

        await useCase.execute();

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Reporte diario generado correctamente"
            })
        };

    } catch (error) {
        if (error instanceof BaseError) {
            console.error(error);

            return {
                statusCode: 400,
                body: JSON.stringify({
                    error: error.userMessage
                })
            };
        }

        console.error(error);

        return {
            statusCode: 500,
            body: JSON.stringify({
                error: "Error al generar el reporte diario"
            })
        };
    }
};