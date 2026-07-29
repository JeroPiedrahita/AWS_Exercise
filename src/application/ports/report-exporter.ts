import {Transaction} from "../../domain/entities/transaction";
import { Buffer } from "buffer";
/**
 * Defines the contract for exporting transaction reports.
 */

export interface ReportExporter {
    /**
     * Generates a report from the provided transactions.
     * 
     * @param transactions Transaction to include in the report.
     * 
     * @return The generated report as a Buffer. 
     */
    export(
        transactions: Transaction[]
    ): Promise<Buffer>;
}