// src/services/excelSync.js

const ExcelJS = require('exceljs');

/**
 * Exports financial data to an Excel file.
 * @param {Array} data - The financial data to export.
 * @param {String} filePath - The path to save the Excel file.
 */
const exportToExcel = async (data, filePath) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Financial Data');

    // Add headers
    worksheet.columns = [
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Amount', key: 'amount', width: 15 },
        { header: 'Description', key: 'description', width: 30 },
        { header: 'Category', key: 'category', width: 20 },
    ];

    // Add rows
    data.forEach(item => {
        worksheet.addRow(item);
    });

    // Write to file
    await workbook.xlsx.writeFile(filePath);
    console.log(`Financial data exported to ${filePath}`);
};

/**
 * Imports financial data from an Excel file.
 * @param {String} filePath - The path to the Excel file.
 * @returns {Promise<Array>} - The imported financial data.
 */
const importFromExcel = async (filePath) => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet(1);
    const data = [];

    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) { // skip header row
            const rowData = row.values.slice(1);
            data.push({
                date: rowData[0],
                amount: rowData[1],
                description: rowData[2],
                category: rowData[3],
            });
        }
    });
    console.log('Financial data imported from Excel');
    return data;
};

/**
 * Generates summary reports from financial data.
 * @param {Array} data - The financial data.
 * @returns {Object} - The summary report.
 */
const generateSummaryReport = (data) => {
    const report = {
        totalAmount: 0,
        categories: {},
    };

    data.forEach(item => {
        report.totalAmount += item.amount;
        report.categories[item.category] = (report.categories[item.category] || 0) + item.amount;
    });

    return report;
};

/**
 * Validates the imported financial data.
 * @param {Array} data - The financial data to validate.
 * @returns {Array} - Array of errors if validation fails, otherwise an empty array.
 */
const validateImportedData = (data) => {
    const errors = [];

    data.forEach((item, index) => {
        if (!item.date || !item.amount || isNaN(item.amount)) {
            errors.push(`Row ${index + 2}: Invalid data`);
        }
    });

    return errors;
};

module.exports = {
    exportToExcel,
    importFromExcel,
    generateSummaryReport,
    validateImportedData,
};
