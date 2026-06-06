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
  primaryIncomeSource = 'Income',
  budgetTargets = [],
}) {
  const key = makeCacheKey(transactions, investments, efEntries, goals, loans, lending) + '|' + selectedCycleId + '|' + primaryIncomeSource;
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

  // ── Per-source balance cards ───────────────────────────────────────────────
  // Gather all known income sources from transactions
  const allSourceNames = new Set();
  transactions.forEach(t => {
    if (t.type === 'income' && t.category) allSourceNames.add(t.category);
  });
  // Always include the primary
  allSourceNames.add(primaryIncomeSource);

  const sourceBalanceCards = [];
  allSourceNames.forEach(sourceName => {
    const isPrimary = sourceName === primaryIncomeSource;

    // Primary = current cycle only; others = all-time cumulative
    const pool = isPrimary ? cycleTransactions : transactions;

    const sourceIncome = pool
      .filter(t => t.type === 'income' && t.category === sourceName)
      .reduce((s, t) => s + (t.amount || 0), 0);

    const sourceExpenses = pool
      .filter(t => t.type === 'expense' && t.fundingSource === sourceName)
      .reduce((s, t) => s + (t.amount || 0), 0);

    let carryOver = 0;
    let netBalance = 0;

    if (isPrimary) {
      const allTimePrimaryIncome = transactions
        .filter(t => t.type === 'income' && t.category === sourceName)
        .reduce((s, t) => s + (t.amount || 0), 0);
      const allTimePrimaryExpenses = transactions
        .filter(t => t.type === 'expense' && t.fundingSource === sourceName)
        .reduce((s, t) => s + (t.amount || 0), 0);
      
      netBalance = allTimePrimaryIncome - allTimePrimaryExpenses;
      carryOver = netBalance - (sourceIncome - sourceExpenses);
    }

    sourceBalanceCards.push({
      name: sourceName,
      isPrimary,
      income: sourceIncome,
      expenses: sourceExpenses,
      balance: sourceIncome - sourceExpenses,
      label: isPrimary ? 'This Cycle' : 'All Time',
      carryOver: isPrimary ? carryOver : null,
      netBalance: isPrimary ? netBalance : null,
    });
  });

  // Sort: primary first, then by balance descending
  sourceBalanceCards.sort((a, b) => {
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    return b.balance - a.balance;
  });

  // ── Legacy sourceBalances (kept for compatibility) ─────────────────────────
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

  // ── Fuel stats — Rolling 3-month window ────────────────────────────────────
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const allFuelEntries = transactions.filter(t =>
    t.type === 'expense' &&
    t.category?.toLowerCase() === 'fuel' &&
    t.litres > 0 &&
    new Date(t.date) >= threeMonthsAgo
  );

  let fuelStats = null;
  if (allFuelEntries.length > 0) {
    const totalFuelSpend = allFuelEntries.reduce((s, t) => s + (t.amount || 0), 0);
    const totalLitres    = allFuelEntries.reduce((s, t) => s + (t.litres  || 0), 0);
    const sortedFuel     = [...allFuelEntries].sort((a, b) => a.date.localeCompare(b.date));

    // Compute mileage from consecutive odometer readings
    let totalKmTraveled = 0;
    let mileageReadings = [];
    for (let i = 1; i < sortedFuel.length; i++) {
      const prev = sortedFuel[i - 1];
      const curr = sortedFuel[i];
      if (curr.odometerReading && prev.odometerReading && curr.litres) {
        const km = curr.odometerReading - prev.odometerReading;
        if (km > 0) {
          totalKmTraveled += km;
          mileageReadings.push(km / curr.litres);
        }
      }
    }
    const avgMileage = mileageReadings.length > 0
      ? mileageReadings.reduce((s, v) => s + v, 0) / mileageReadings.length
      : null;
    const costPerKm = totalKmTraveled > 0 ? totalFuelSpend / totalKmTraveled : null;

    // Per-month breakdown
    const monthlyMap = {};
    allFuelEntries.forEach(t => {
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyMap[key]) monthlyMap[key] = { spend: 0, litres: 0, refills: 0 };
      monthlyMap[key].spend += t.amount || 0;
      monthlyMap[key].litres += t.litres || 0;
      monthlyMap[key].refills += 1;
    });
    const monthlyBreakdown = Object.entries(monthlyMap)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, data]) => {
        const [y, m] = key.split('-');
        const label = new Date(parseInt(y), parseInt(m) - 1, 1)
          .toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        return { month: label, ...data };
      });

    fuelStats = {
      totalSpend: totalFuelSpend,
      totalLitres,
      avgMileage,
      costPerKm,
      entries: allFuelEntries.length,
      totalKmTraveled,
      monthlyBreakdown,
    };
  }

  // ── Budget vs Actual ──────────────────────────────────────────────────────
  const budgetComparison = budgetTargets.map(b => {
    const spent = categoryBreakdown[b.category] || 0;
    const pct = b.limit > 0 ? (spent / b.limit) * 100 : 0;
    return {
      category: b.category,
      limit: b.limit,
      spent,
      remaining: b.limit - spent,
      percent: Math.min(pct, 100),
      isOver: spent > b.limit,
    };
  });

  // ── Savings Streak ────────────────────────────────────────────────────────
  // How many consecutive cycles (most recent first) had savings > 0
  const allCycleIds = Object.keys(monthMap).sort().reverse();
  let savingsStreak = 0;
  for (const cid of allCycleIds) {
    const m = monthMap[cid];
    if ((m.income - m.expenses) > 0) {
      savingsStreak++;
    } else {
      break;
    }
  }

  const netWorth = savings + totalCurrentVal + efBalance + totalGoalSaved - totalLoanRemaining;

  _cache = {
    totalIncome, totalExpenses, savings, savingsRate, netWorth,
    categoryBreakdown, categoryChartData, trendData,
    sourceBalances, sourceBalanceCards,
    totalInvested, totalCurrentVal, investmentGain,
    efBalance, efMonths,
    totalGoalTarget, totalGoalSaved,
    totalLoanRemaining, totalLendingOutstanding,
    recentTransactions,
    fuelStats,
    budgetComparison,
    savingsStreak,
  };
  _cacheKey = key;
  return _cache;
}

export function invalidateDashboardCache() {
  _cache = null;
  _cacheKey = '';
}
