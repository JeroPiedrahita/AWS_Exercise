import { ReportExporter } from "../../application/ports/report-exporter";
import { Workbook } from "exceljs";
import { Transaction } from "../../domain/entities/transaction";
/**
 * Excel-based implementation of the report exporter.
 * 
 * Generates transaction reports in XLSX format.
 */
export class ExcelReportExporter implements ReportExporter{
/**
 * Generates an Excel report from the provided transaction collection.
 * 
 * @param transactions Transaction to include in the report. 
 * @returns The generated Excel file as a Buffer.
 */
    async export(
        transactions: Transaction[]): Promise <Buffer> {
            const workbook = new Workbook();
            const sheet = workbook.addWorksheet(
                "Transacciones"
            );
            sheet.columns = [
                {
                    header: "ID",
                    key: "id"
                },
                {
                    header: "Cuenta",
                    key: "accountId"
                },
                {
                    header: "Monto",
                    key: "amount"
                },
                {
                    header: "Estado",
                    key: "status"
                },
                {
                    header: "Fecha",
                    key: "createdAt"
                }
            ];
            transactions.forEach(transaction => {
                sheet.addRow({
                    id: transaction.id,
                    accountId: transaction.accountId,
                    amount: transaction.amount,
                    status: transaction.status,
                    createdAt: transaction.createdAt.toISOString()
                });
            })
            const content = await workbook.xlsx.writeBuffer();

            return Buffer.from(content);
        }
    
}