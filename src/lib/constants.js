// Default expense categories based on your Excel data
export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Food', icon: '🍔', color: '#FF6B6B' },
  { name: 'Groceries/Online Order', icon: '🛒', color: '#4ECDC4' },
  { name: 'House', icon: '🏠', color: '#45B7D1' },
  { name: 'Fuel', icon: '⛽', color: '#F7DC6F' },
  { name: 'Transport', icon: '🚗', color: '#BB8FCE' },
  { name: 'Parking', icon: '🅿️', color: '#85C1E9' },
  { name: 'Internet', icon: '🌐', color: '#82E0AA' },
  { name: 'Electronics', icon: '📱', color: '#F8C471' },
  { name: 'Doctor/Medicine', icon: '💊', color: '#F1948A' },
  { name: 'GYM', icon: '🏋️', color: '#00E676' },
  { name: 'Badminton+Extra', icon: '🏸', color: '#76D7C4' },
  { name: 'Shopping', icon: '🛍️', color: '#D7BDE2' },
  { name: 'Personal', icon: '👤', color: '#AED6F1' },
  { name: 'Looks', icon: '💇', color: '#FADBD8' },
  { name: 'Subscriptions', icon: '📺', color: '#A9CCE3' },
  { name: 'Bank Charges', icon: '🏦', color: '#D5DBDB' },
  { name: 'Gold', icon: '🥇', color: '#D4AF37' },
  { name: 'FD', icon: '🏦', color: '#5DADE2' },
  { name: 'Stocks', icon: '📊', color: '#58D68D' },
  { name: 'SIPS', icon: '📈', color: '#48C9B0' },
  { name: 'Debt Fund', icon: '💰', color: '#F0B27A' },
  { name: 'Refund/Repay', icon: '🔄', color: '#82E0AA' },
  { name: 'Misc', icon: '📌', color: '#ABB2B9' },
];

// Default income source types
export const DEFAULT_INCOME_SOURCES = [
  { name: 'Income', type: 'salary', color: '#00E676', icon: '💼' },
  { name: 'Income 2.0', type: 'freelance', color: '#D4AF37', icon: '💻' },
];

export const DEFAULT_REFUND_SOURCES = [
  { name: 'Expense Refund', type: 'refund', color: '#45B7D1', icon: '🔄' },
  { name: 'Lending Repay', type: 'repay', color: '#82E0AA', icon: '🤝' },
  { name: 'Cashback', type: 'cashback', color: '#F7DC6F', icon: '✨' },
];

// Default investment buckets
export const DEFAULT_INVESTMENT_BUCKETS = [
  { name: 'Gold Digital', icon: '🥇', color: '#D4AF37' },
  { name: 'FD', icon: '🏦', color: '#5DADE2' },
  { name: 'Debt Funds', icon: '💰', color: '#F0B27A' },
  { name: 'Gold ETF', icon: '✨', color: '#F5D76E' },
  { name: 'Stocks', icon: '📊', color: '#58D68D' },
  { name: 'Mutual Funds', icon: '📈', color: '#48C9B0' },
  { name: 'Nifty 50 ETF', icon: '🇮🇳', color: '#FF6B6B' },
  { name: 'JuniorBEES', icon: '🐝', color: '#F7DC6F' },
];

// Lending statuses
export const LENDING_STATUSES = ['waiting', 'partial', 'returned', 'written-off'];

// Goal priorities
export const GOAL_PRIORITIES = ['low', 'medium', 'high', 'critical'];

// Currency
export const CURRENCY = '₹';
export const CURRENCY_CODE = 'INR';
export const LOCALE = 'en-IN';

// Format currency
export function formatCurrency(amount, showSign = false) {
  if (amount === null || amount === undefined || isNaN(amount)) return `${CURRENCY}0`;
  const formatted = new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: CURRENCY_CODE,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    minimumFractionDigits: 0,
  }).format(Math.abs(amount));
  
  if (showSign && amount !== 0) {
    return amount > 0 ? `+${formatted}` : `-${formatted}`;
  }
  return amount < 0 ? `-${formatted}` : formatted;
}

// Format date
export function formatDate(date, format = 'short') {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  
  switch (format) {
    case 'short':
      return d.toLocaleDateString(LOCALE, { day: '2-digit', month: 'short' });
    case 'medium':
      return d.toLocaleDateString(LOCALE, { day: '2-digit', month: 'short', year: 'numeric' });
    case 'long':
      return d.toLocaleDateString(LOCALE, { day: '2-digit', month: 'long', year: 'numeric' });
    case 'iso':
      return d.toISOString().split('T')[0];
    default:
      return d.toLocaleDateString(LOCALE);
  }
}

// Format percentage
export function formatPercent(value, decimals = 1) {
  if (value === null || value === undefined || isNaN(value)) return '0%';
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

// Category icon map
export function getCategoryIcon(categoryName) {
  const cat = DEFAULT_EXPENSE_CATEGORIES.find(
    c => c.name.toLowerCase() === categoryName?.toLowerCase()
  );
  return cat?.icon || '📌';
}

export function getCategoryColor(categoryName) {
  const cat = DEFAULT_EXPENSE_CATEGORIES.find(
    c => c.name.toLowerCase() === categoryName?.toLowerCase()
  );
  return cat?.color || '#ABB2B9';
}
