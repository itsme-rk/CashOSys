/**
 * Dashboard Aggregation & Cache Layer
 *
 * Instead of 7 separate Firestore listeners re-triggering full re-renders,
 * we consolidate data into a single computed snapshot and cache it in memory.
 *
 * Cache invalidation strategy:
 *  - invalidated when transactions, investments, or other data changes
 *  - AI insights use their own Firestore-persisted cache (cycleId-keyed)
 */

// ─── In-memory session cache ─────────────────────────────────────────────────
let _cache = null;
let _cacheKey = '';

function makeCacheKey(transactions, investments, efEntries, goals, loans, lending) {
  return [
    transactions.length,
    investments.length,
    efEntries.length,
    goals.length,
    loans.length,
    lending.length,
    // Use dates of latest entries as a fast fingerprint
    transactions[0]?.date || '',
    investments[0]?.id || '',
  ].join('|');
}

/**
 * Compute all dashboard metrics from raw data.
 * Memoised — only recomputes when the data fingerprint changes.
 */
export function getDashboardData({
  transactions,
  investments,
  efEntries,
  goals,
  loans,
  lending,
  salaryCycleDay,
  incomeDates,
  selectedCycleId,
  getCycleForDate,
}) {
  const key = makeCacheKey(transactions, investments, efEntries, goals, loans, lending) + '|' + selectedCycleId;
  if (_cache && _cacheKey === key) return _cache;

  // ── Cycle-filtered transactions ────────────────────────────────────────────
  const cycleTransactions = transactions.filter(t => {
    if (!t.date) return false;
    if (!selectedCycleId) return true;
    const cycle = getCycleForDate(t.date, salaryCycleDay, incomeDates);
    return cycle.id === selectedCycleId;
  });

  const incomeEntries   = cycleTransactions.filter(t => t.type === 'income');
  const expenseEntries  = cycleTransactions.filter(t => t.type === 'expense');

  const totalIncome     = incomeEntries.reduce((s, t) => s + (t.amount || 0), 0);
  const totalExpenses   = expenseEntries.reduce((s, t) => s + (t.amount || 0), 0);
  const savings         = totalIncome - totalExpenses;
  const savingsRate     = totalIncome > 0 ? (savings / totalIncome) * 100 : 0;

  // ── Category breakdown ─────────────────────────────────────────────────────
  const categoryBreakdown = {};
  expenseEntries.forEach(t => {
    const cat = t.category || 'Misc';
    categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + (t.amount || 0);
  });

  const categoryChartData = Object.entries(categoryBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name, value }));

  // ── Monthly trend (last 6 cycles) ─────────────────────────────────────────
  const monthMap = {};
  transactions.forEach(t => {
    if (!t.date) return;
    const cycle = getCycleForDate(t.date, salaryCycleDay, incomeDates);
    const k = cycle.id;
    if (!monthMap[k]) monthMap[k] = { name: cycle.label, income: 0, expenses: 0 };
    if (t.type === 'income')   monthMap[k].income   += t.amount || 0;
    if (t.type === 'expense')  monthMap[k].expenses += t.amount || 0;
  });
  const trendData = Object.values(monthMap)
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(-6);

  // ── Per-source balance ─────────────────────────────────────────────────────
  const sourceBalances = {};
  incomeEntries.forEach(t => {
    const src = t.category || 'Income';
    sourceBalances[src] = (sourceBalances[src] || 0) + (t.amount || 0);
  });
  expenseEntries.forEach(t => {
    const src = t.fundingSource;
    if (src && sourceBalances[src] !== undefined) {
      sourceBalances[src] -= t.amount || 0;
    }
  });

  // ── Investments ────────────────────────────────────────────────────────────
  const totalInvested    = investments.reduce((s, i) => s + (i.investedAmount || 0), 0);
  const totalCurrentVal  = investments.reduce((s, i) => s + (i.currentValue   || i.investedAmount || 0), 0);
  const investmentGain   = totalCurrentVal - totalInvested;

  // ── Emergency fund ─────────────────────────────────────────────────────────
  const efBalance = efEntries.reduce((s, e) => {
    return e.type === 'withdrawal' ? s - (e.amount || 0) : s + (e.amount || 0);
  }, 0);
  const avgMonthlyExpenses = totalExpenses > 0 ? totalExpenses : 1;
  const efMonths = efBalance / avgMonthlyExpenses;

  // ── Goals ──────────────────────────────────────────────────────────────────
  const totalGoalTarget = goals.reduce((s, g) => s + (g.targetAmount || 0), 0);
  const totalGoalSaved  = goals.reduce((s, g) => s + (g.savedAmount  || 0), 0);

  // ── Loans ──────────────────────────────────────────────────────────────────
  const totalLoanRemaining = loans.reduce((s, l) =>
    s + Math.max(0, (l.totalAmount || 0) - (l.paidTillDate || 0)), 0);

  // ── Lending outstanding ────────────────────────────────────────────────────
  const totalLendingOutstanding = lending
    .filter(l => l.status === 'waiting' || l.status === 'partial')
    .reduce((s, l) => s + (l.amount || 0), 0);

  // ── Recent transactions ────────────────────────────────────────────────────
  const recentTransactions = cycleTransactions.slice(0, 10);

  // ── Fuel stats ────────────────────────────────────────────────────────────
  const fuelEntries = expenseEntries.filter(t =>
    t.category?.toLowerCase() === 'fuel' && t.litres > 0
  );
  let fuelStats = null;
  if (fuelEntries.length > 0) {
    const totalFuelSpend = fuelEntries.reduce((s, t) => s + (t.amount || 0), 0);
    const totalLitres    = fuelEntries.reduce((s, t) => s + (t.litres  || 0), 0);
    const sortedFuel     = [...fuelEntries].sort((a, b) => a.date.localeCompare(b.date));
    let totalMileage = 0, mileageCount = 0;
    for (let i = 1; i < sortedFuel.length; i++) {
      const prev = sortedFuel[i - 1];
      const curr = sortedFuel[i];
      if (curr.odometerReading && prev.odometerReading && curr.litres) {
        const km = curr.odometerReading - prev.odometerReading;
        if (km > 0) { totalMileage += km / curr.litres; mileageCount++; }
      }
    }
    fuelStats = {
      totalSpend: totalFuelSpend,
      totalLitres,
      avgMileage: mileageCount > 0 ? totalMileage / mileageCount : null,
      costPerKm:  mileageCount > 0 ? totalFuelSpend / (totalMileage * mileageCount) : null,
      entries:    fuelEntries.length,
    };
  }

  const netWorth = savings + totalCurrentVal + efBalance + totalGoalSaved - totalLoanRemaining;

  _cache = {
    totalIncome, totalExpenses, savings, savingsRate, netWorth,
    categoryBreakdown, categoryChartData, trendData,
    sourceBalances,
    totalInvested, totalCurrentVal, investmentGain,
    efBalance, efMonths,
    totalGoalTarget, totalGoalSaved,
    totalLoanRemaining, totalLendingOutstanding,
    recentTransactions,
    fuelStats,
  };
  _cacheKey = key;
  return _cache;
}

export function invalidateDashboardCache() {
  _cache = null;
  _cacheKey = '';
}
