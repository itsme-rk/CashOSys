/**
 * Excel Import/Export for CashOSys
 * Maps between the user's existing Excel finance tracker format and Firestore collections.
 */

import { getCycleForDate } from './salaryCycle';

// ============================================================
// IMPORT: Parse Excel workbook → structured data
// ============================================================
export function parseExcelWorkbook(workbook, XLSX, salaryCycleDay = 28) {
  const result = {
    income: [],
    expenses: [],
    investments: [],
    emergencyFund: [],
    lending: [],
    goals: [],
    loans: [],
    summary: {},
    errors: [],
  };

  const sheetNames = workbook.SheetNames.map(n => n.toLowerCase().trim());

  // ---- INCOME ----
  const incomeSheets = ['income', 'income 2.0'];
  incomeSheets.forEach(name => {
    const idx = sheetNames.findIndex(s => s === name || s.includes(name));
    if (idx === -1) return;
    const sheet = workbook.Sheets[workbook.SheetNames[idx]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    
    rows.forEach((row, i) => {
      try {
        const date = parseExcelDate(row.Date || row.date || row.A, XLSX);
        const amount = parseFloat(row.Amount || row.amount || row.C || 0);
        const source = row.Source || row.source || row.B || name;
        if (!amount || amount <= 0) return;
        
        const cycle = getCycleForDate(date, salaryCycleDay);
        result.income.push({
          type: 'income',
          category: source.includes('2.0') ? 'Income 2.0' : 'Income',
          description: `${source} - Imported`,
          amount,
          date: formatDateISO(date),
          fundingSource: source,
          salaryCycleId: cycle.id,
          salaryCycleLabel: cycle.label,
          isInvestment: false,
        });
      } catch (err) {
        result.errors.push(`Income row ${i + 1}: ${err.message}`);
      }
    });
  });

  // ---- EXPENSES ----
  const expIdx = sheetNames.findIndex(s => s === 'expenses' || s.includes('expense'));
  if (expIdx >= 0) {
    const sheet = workbook.Sheets[workbook.SheetNames[expIdx]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    
    rows.forEach((row, i) => {
      try {
        const date = parseExcelDate(row.Date || row.date || row.A, XLSX);
        const category = row.Category || row.category || row.B || 'Misc';
        const description = row.Description || row.description || row.C || '';
        const amount = parseFloat(row.Amount || row.amount || row.D || 0);
        const fundingSource = row['Funding Source'] || row.fundingSource || row.E || 'Income';
        if (!amount || amount <= 0) return;
        
        const isInvCat = ['Gold', 'FD', 'Stocks', 'SIPS', 'Debt Fund', 'Debt fund'].includes(category);
        const cycle = getCycleForDate(date, salaryCycleDay);
        
        result.expenses.push({
          type: 'expense',
          category,
          description,
          amount,
          date: formatDateISO(date),
          fundingSource,
          salaryCycleId: cycle.id,
          salaryCycleLabel: cycle.label,
          isInvestment: isInvCat,
        });
      } catch (err) {
        result.errors.push(`Expense row ${i + 1}: ${err.message}`);
      }
    });
  }

  // ---- INVESTMENTS ----
  const invIdx = sheetNames.findIndex(s => s.includes('invest'));
  if (invIdx >= 0) {
    const sheet = workbook.Sheets[workbook.SheetNames[invIdx]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    
    rows.forEach((row, i) => {
      try {
        const bucket = row.Bucket || row.bucket || row.A || '';
        const fundingSource = row['Funding Source'] || row.fundingSource || row.B || '';
        const date = parseExcelDate(row.Date || row.date || row.C, XLSX);
        const description = row.Description || row.description || row.D || '';
        const added = parseFloat(row.Added || row.added || row.E || 0);
        const withdrawal = parseFloat(row.Withdrawal || row.withdrawal || row.F || 0);
        if (!bucket && !added) return;
        
        result.investments.push({
          bucket: bucket.trim(),
          instrumentName: description,
          fundingSource,
          investedAmount: added,
          currentValue: added - withdrawal,
          quantity: 0,
          ticker: '',
          purchaseDate: formatDateISO(date),
          description,
          withdrawal,
        });
      } catch (err) {
        result.errors.push(`Investment row ${i + 1}: ${err.message}`);
      }
    });
  }

  // ---- EMERGENCY FUND ----
  const efIdx = sheetNames.findIndex(s => s.includes('emergency'));
  if (efIdx >= 0) {
    const sheet = workbook.Sheets[workbook.SheetNames[efIdx]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    
    rows.forEach((row, i) => {
      try {
        const date = parseExcelDate(row.Date || row.date || row.A, XLSX);
        const description = row.Description || row.description || row.C || '';
        const amount = parseFloat(row.Amount || row.amount || row.D || 0);
        if (!amount) return;
        
        result.emergencyFund.push({
          description,
          amount,
          date: formatDateISO(date),
          type: amount >= 0 ? 'deposit' : 'withdrawal',
        });
      } catch (err) {
        result.errors.push(`Emergency Fund row ${i + 1}: ${err.message}`);
      }
    });
  }

  // ---- UNUSED FUNDS / LENDING ----
  const unusedIdx = sheetNames.findIndex(s => s.includes('unused') || s.includes('lending'));
  if (unusedIdx >= 0) {
    const sheet = workbook.Sheets[workbook.SheetNames[unusedIdx]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    
    rows.forEach((row, i) => {
      try {
        // Look for lending rows (person name + amount + status)
        const person = row.To || row.to || row.Person || row.person || row.B || '';
        const amount = parseFloat(row.Amount || row.amount || row.C || 0);
        const status = (row.Status || row.status || row.D || 'waiting').toLowerCase();
        const date = parseExcelDate(row.Date || row.date || row.A, XLSX);
        if (!person || !amount) return;
        
        result.lending.push({
          personName: person,
          amount,
          date: formatDateISO(date),
          status: status.includes('return') ? 'returned' : status.includes('partial') ? 'partial' : 'waiting',
          expectedReturn: null,
          notes: '',
        });
      } catch (err) {
        result.errors.push(`Lending row ${i + 1}: ${err.message}`);
      }
    });
  }

  // ---- LOANS ----
  const loanIdx = sheetNames.findIndex(s => s === 'loans' || s.includes('loan'));
  if (loanIdx >= 0) {
    const sheet = workbook.Sheets[workbook.SheetNames[loanIdx]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    
    rows.forEach((row, i) => {
      try {
        const name = row['Loan Name'] || row.Name || row.name || row.A || '';
        const totalAmount = parseFloat(row['Total Amount'] || row.totalAmount || row.B || 0);
        if (!name || !totalAmount) return;
        
        result.loans.push({
          name,
          totalAmount,
          emi: parseFloat(row.EMI || row.emi || row.C || 0),
          paidTillDate: parseFloat(row['Paid Till Date'] || row.paidTillDate || row.D || 0),
          interestRate: 0,
          startDate: '',
          endDate: '',
        });
      } catch {
        result.errors.push(`Loan row ${i + 1}: Parse error`);
      }
    });
  }

  // ---- GOALS ----
  const goalIdx = sheetNames.findIndex(s => s === 'goals' || s.includes('goal'));
  if (goalIdx >= 0) {
    const sheet = workbook.Sheets[workbook.SheetNames[goalIdx]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    
    rows.forEach((row, i) => {
      try {
        const name = row.Goal || row.Name || row.name || row.A || '';
        const targetAmount = parseFloat(row['Target Amount'] || row.targetAmount || row.B || 0);
        if (!name || !targetAmount) return;
        
        result.goals.push({
          name,
          targetAmount,
          savedAmount: parseFloat(row['Saved Till Date'] || row.savedAmount || row.C || 0),
          deadline: null,
          priority: 'medium',
        });
      } catch {
        result.errors.push(`Goal row ${i + 1}: Parse error`);
      }
    });
  }

  // Summary
  result.summary = {
    income: result.income.length,
    expenses: result.expenses.length,
    investments: result.investments.length,
    emergencyFund: result.emergencyFund.length,
    lending: result.lending.length,
    loans: result.loans.length,
    goals: result.goals.length,
    errors: result.errors.length,
    total: result.income.length + result.expenses.length + result.investments.length +
           result.emergencyFund.length + result.lending.length + result.loans.length + result.goals.length,
  };

  return result;
}


// ============================================================
// EXPORT: Firestore data → Excel workbook
// ============================================================
export function buildExportWorkbook(data, XLSX) {
  const wb = XLSX.utils.book_new();

  // Income sheet
  if (data.transactions?.length) {
    const incomeRows = data.transactions
      .filter(t => t.type === 'income')
      .map(t => ({
        Date: t.date,
        Source: t.category || 'Income',
        Amount: t.amount,
        Description: t.description || '',
        'Salary Cycle': t.salaryCycleLabel || '',
      }));
    if (incomeRows.length) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(incomeRows), 'Income');
    }
  }

  // Expenses sheet
  if (data.transactions?.length) {
    const expenseRows = data.transactions
      .filter(t => t.type === 'expense')
      .map(t => ({
        Date: t.date,
        Category: t.category,
        Description: t.description || '',
        Amount: t.amount,
        'Funding Source': t.fundingSource || '',
        'Salary Cycle': t.salaryCycleLabel || '',
        'Is Investment': t.isInvestment ? 'Yes' : 'No',
      }));
    if (expenseRows.length) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expenseRows), 'Expenses');
    }
  }

  // Investments sheet
  if (data.investments?.length) {
    const invRows = data.investments.map(i => ({
      Bucket: i.bucket,
      'Instrument Name': i.instrumentName || i.description || '',
      Ticker: i.ticker || '',
      'Invested Amount': i.investedAmount,
      'Current Value': i.currentValue || i.investedAmount,
      Quantity: i.quantity || '',
      Withdrawal: i.withdrawal || 0,
      'Purchase Date': i.purchaseDate || '',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invRows), 'Investments');
  }

  // Emergency Fund sheet
  if (data.emergencyFund?.length) {
    let running = 0;
    const efRows = data.emergencyFund.map(e => {
      running += e.amount || 0;
      return {
        Date: e.date,
        Description: e.description || '',
        Amount: e.amount,
        'Running Balance': running,
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(efRows), 'Emergency Fund');
  }

  // Goals sheet
  if (data.goals?.length) {
    const goalRows = data.goals.map(g => ({
      Goal: g.name,
      'Target Amount': g.targetAmount,
      'Saved Till Date': g.savedAmount || 0,
      Remaining: (g.targetAmount || 0) - (g.savedAmount || 0),
      Priority: g.priority || '',
      Deadline: g.deadline || '',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(goalRows), 'Goals');
  }

  // Loans sheet
  if (data.loans?.length) {
    const loanRows = data.loans.map(l => ({
      'Loan Name': l.name,
      'Total Amount': l.totalAmount,
      EMI: l.emi || '',
      'Interest Rate': l.interestRate ? `${l.interestRate}%` : '',
      'Paid Till Date': l.paidTillDate || 0,
      Remaining: (l.totalAmount || 0) - (l.paidTillDate || 0),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(loanRows), 'Loans');
  }

  // Lending sheet
  if (data.lending?.length) {
    const lendRows = data.lending.map(l => ({
      Date: l.date,
      Person: l.personName,
      Amount: l.amount,
      Status: l.status,
      'Expected Return': l.expectedReturn || '',
      Notes: l.notes || '',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lendRows), 'Personal Lending');
  }

  // Summary / Dashboard sheet
  const incomeTotal = (data.transactions || []).filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expenseTotal = (data.transactions || []).filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const investTotal = (data.investments || []).reduce((s, i) => s + (i.investedAmount || 0) - (i.withdrawal || 0), 0);
  const efTotal = (data.emergencyFund || []).reduce((s, e) => s + (e.amount || 0), 0);

  const dashRows = [
    { Metric: 'Total Income', Value: incomeTotal },
    { Metric: 'Total Expenses', Value: expenseTotal },
    { Metric: 'Net Balance', Value: incomeTotal - expenseTotal },
    { Metric: 'Savings Rate', Value: incomeTotal > 0 ? `${((incomeTotal - expenseTotal) / incomeTotal * 100).toFixed(1)}%` : '0%' },
    { Metric: 'Total Invested', Value: investTotal },
    { Metric: 'Emergency Fund', Value: efTotal },
    { Metric: 'Export Date', Value: new Date().toLocaleDateString('en-IN') },
    { Metric: 'Exported By', Value: 'CashOSys — Personal Finance OS' },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dashRows), 'Dashboard');

  return wb;
}


// ============================================================
// HELPERS
// ============================================================
function parseExcelDate(value, XLSX) {
  if (!value) return new Date();
  
  // Excel serial number
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    return new Date(date.y, date.m - 1, date.d);
  }
  
  // String date
  const d = new Date(value);
  if (!isNaN(d.getTime())) return d;
  
  // Try DD/MM/YYYY or DD-MM-YYYY
  const parts = value.split(/[\/\-]/);
  if (parts.length === 3) {
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
    const year = parseInt(parts[2]);
    return new Date(year, month, day);
  }
  
  return new Date();
}

function formatDateISO(date) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return new Date().toISOString().split('T')[0];
  }
  return date.toISOString().split('T')[0];
}
