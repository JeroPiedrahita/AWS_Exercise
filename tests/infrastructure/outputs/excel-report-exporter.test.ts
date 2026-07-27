import { ExcelReportExporter } from '@/infrastructure/outputs/excel-report-exporter';
import { createTransactionList } from '../../fixtures/transaction.fixtures';
import { Workbook } from 'exceljs';

describe('ExcelReportExporter', () => {
    let exporter: ExcelReportExporter;

    beforeEach(() => {
        exporter = new ExcelReportExporter();
    });

    it('should return a Buffer when exporting transactions', async () => {
        const transactions = createTransactionList(3);

        const result = await exporter.export(transactions);

        expect(result).toBeInstanceOf(Buffer);
        expect(result.length).toBeGreaterThan(0);
    });

    it('should generate a valid Excel file with correct headers', async () => {
        const transactions = createTransactionList(2);

        const buffer = await exporter.export(transactions);

        const workbook = new Workbook();
        await workbook.xlsx.load(buffer);

        const sheet = workbook.getWorksheet('Transacciones');
        expect(sheet).toBeDefined();

        const headerRow = sheet!.getRow(1);
        expect(headerRow.getCell(1).value).toBe('ID');
        expect(headerRow.getCell(2).value).toBe('Cuenta');
        expect(headerRow.getCell(3).value).toBe('Monto');
        expect(headerRow.getCell(4).value).toBe('Estado');
        expect(headerRow.getCell(5).value).toBe('Fecha');
    });

    it('should include all transactions as rows in the worksheet', async () => {
        const transactions = createTransactionList(3);

        const buffer = await exporter.export(transactions);

        const workbook = new Workbook();
        await workbook.xlsx.load(buffer);

        const sheet = workbook.getWorksheet('Transacciones');
        expect(sheet).toBeDefined();

        // Row 1 is header, rows 2-4 are data
        expect(sheet!.rowCount).toBe(4);

        const firstDataRow = sheet!.getRow(2);
        expect(firstDataRow.getCell(1).value).toBe(transactions[0]!.id);
        expect(firstDataRow.getCell(2).value).toBe(transactions[0]!.accountId);
        expect(firstDataRow.getCell(3).value).toBe(transactions[0]!.amount);
        expect(firstDataRow.getCell(4).value).toBe(transactions[0]!.status);
        expect(firstDataRow.getCell(5).value).toBe(transactions[0]!.createdAt.toISOString());
    });

    it('should return a valid Buffer when transactions array is empty', async () => {
        const result = await exporter.export([]);

        expect(result).toBeInstanceOf(Buffer);
        expect(result.length).toBeGreaterThan(0);

        const workbook = new Workbook();
        await workbook.xlsx.load(result);

        const sheet = workbook.getWorksheet('Transacciones');
        expect(sheet).toBeDefined();
        // Only header row
        expect(sheet!.rowCount).toBe(1);
    });
});
