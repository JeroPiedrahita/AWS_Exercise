import {ITransactionRepository} from "../domain/ports/transaction-repository";
import { ReportExporter } from "./ports/report-exporter";
import { FileStorage } from "./ports/file-storage";

/**
 * Use case responsible for generating
 * a daily transaction report and storing it.
 */

export class GenerateDailyReportUseCase {
    /**
     * Creates a new instance of the use case.
     * @param repository used to retrieve transaction.
     * @param reportExporter Service used to generated the report file.
     * @param fileStorage Service used to store generated files.
     */
    constructor(
        private readonly repository: ITransactionRepository,
        private readonly reportExporter: ReportExporter,
        private readonly fileStorage: FileStorage
    ){}
    /**
     * Generates a report containing all transactions
     * created during the current day and uploads it to the
     * configured storage service.
     * 
     * @returns A promise that resolves when the report has been 
     * successfully stored.
     */

    async execute(): Promise <void> {
        const now = new Date();
        const startDate = new Date(now);
        startDate.setHours(0,0,0,0);

        const endDate = new Date(now);
        endDate.setHours(23,59,59,999)

        const transactions = 
        await this.repository.getTransactionsBetweenDates(
            startDate,
            endDate
        );

        const report = await this.reportExporter.export(
            transactions
        );

        const fileName = `reporte-${now.toISOString().split("T")[0]}.xlsx`;
        await this.fileStorage.save(
            fileName,
            report
        );
        // TODO: Implementar descarga con URL prefirmada 

    }
}