'use client';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { subscribeToCollection } from '@/lib/firestore';
import { formatCurrency, formatPercent } from '@/lib/constants';
import {
  CalendarRange, TrendingUp, TrendingDown, PiggyBank,
  BarChart3, Trophy, AlertCircle, Sparkles, Wallet,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import styles from './year-review.module.css';

const CHART_COLORS = ['#00E676', '#D4AF37', '#FF6B6B', '#448AFF', '#BB8FCE', '#F7DC6F'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function YearReviewPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (!user) return;
    const u1 = subscribeToCollection(user.uid, 'transactions', setTransactions);
    const u2 = subscribeToCollection(user.uid, 'investments', setInvestments);
    return () => { u1(); u2(); };
  }, [user]);

  // Available years from data
  const availableYears = useMemo(() => {
    const years = new Set();
    transactions.forEach(t => {
      if (t.date) years.add(new Date(t.date).getFullYear());
    });
    if (years.size === 0) years.add(new Date().getFullYear());
    return [...years].sort((a, b) => b - a);
  }, [transactions]);

  // Filter transactions for selected year
  const yearTxns = useMemo(() => {
    return transactions.filter(t => {
      if (!t.date) return false;
      return new Date(t.date).getFullYear() === selectedYear;
    });
  }, [transactions, selectedYear]);

  // Core metrics
  const metrics = useMemo(() => {
    const income = yearTxns.filter(t => t.type === 'income');
    const expenses = yearTxns.filter(t => t.type === 'expense');
    const totalIncome = income.reduce((s, t) => s + (t.amount || 0), 0);
    const totalExpenses = expenses.reduce((s, t) => s + (t.amount || 0), 0);
    const totalSaved = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? (totalSaved / totalIncome) * 100 : 0;

    // Month-by-month data
    const monthlyData = MONTH_NAMES.map((name, i) => {
      const monthIncome = income
        .filter(t => new Date(t.date).getMonth() === i)
        .reduce((s, t) => s + (t.amount || 0), 0);
      const monthExpenses = expenses
        .filter(t => new Date(t.date).getMonth() === i)
        .reduce((s, t) => s + (t.amount || 0), 0);
      return {
        month: name,
        income: monthIncome,
        expenses: monthExpenses,
        savings: monthIncome - monthExpenses,
      };
    });

    // Only include months that have data
    const activeMonths = monthlyData.filter(m => m.income > 0 || m.expenses > 0);

    // Best and worst savings months
    const monthsWithSavings = activeMonths.filter(m => m.income > 0 || m.expenses > 0);
    const bestMonth = monthsWithSavings.length > 0
      ? monthsWithSavings.reduce((best, m) => m.savings > best.savings ? m : best, monthsWithSavings[0])
      : null;
    const worstMonth = monthsWithSavings.length > 0
      ? monthsWithSavings.reduce((worst, m) => m.savings < worst.savings ? m : worst, monthsWithSavings[0])
      : null;

    // Top expense categories
    const catMap = {};
    expenses.forEach(t => {
      const cat = t.category || 'Misc';
      catMap[cat] = (catMap[cat] || 0) + (t.amount || 0);
    });
    const topCategories = Object.entries(catMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, amount]) => ({
        name,
        amount,
        percent: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
      }));

    // Investments made this year
    const yearInvestments = investments.filter(inv => {
      if (!inv.purchaseDate) return false;
      return new Date(inv.purchaseDate).getFullYear() === selectedYear;
    });
    const totalInvested = yearInvestments.reduce((s, i) => s + (i.investedAmount || 0), 0);

    // Fun stat: days worth of income spent on biggest category
    const dailyIncome = totalIncome / 365;
    const topCatAmount = topCategories.length > 0 ? topCategories[0].amount : 0;
    const topCatName = topCategories.length > 0 ? topCategories[0].name : 'N/A';
    const daysWorthSpent = dailyIncome > 0 ? Math.round(topCatAmount / dailyIncome) : 0;

    // Net worth change (income - expenses for year)
    const netWorthChange = totalSaved;

    return {
      totalIncome,
      totalExpenses,
      totalSaved,
      savingsRate,
      netWorthChange,
      monthlyData,
      activeMonths,
      bestMonth,
      worstMonth,
      topCategories,
      totalInvested,
      topCatName,
      daysWorthSpent,
    };
  }, [yearTxns, investments, selectedYear]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload) return null;
    return (
      <div className={styles.chartTooltip}>
        <p className={styles.tooltipLabel}>{label}</p>
        {payload.map((entry, i) => (
          <div key={i} className={styles.tooltipRow} style={{ color: entry.color }}>
            {entry.name}: {formatCurrency(entry.value)}
          </div>
        ))}
      </div>
    );
  };

  const hasData = yearTxns.length > 0;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <CalendarRange size={28} className={styles.titleIcon} /> Year in Review
          </h1>
          <p className={styles.subtitle}>
            Your complete financial summary for {selectedYear}
          </p>
        </div>
        <div className={styles.yearSelector}>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(parseInt(e.target.value, 10))}
          >
            {availableYears.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {!hasData ? (
        <div className="card empty-state">
          <CalendarRange size={48} />
          <h3>No data for {selectedYear}</h3>
          <p>Add transactions to see your year-in-review</p>
        </div>
      ) : (
        <>
          {/* Hero stats */}
          <div className={styles.heroStats}>
            <div className={`card ${styles.heroCard}`}>
              <div className={styles.heroIconWrap} style={{ background: 'rgba(0, 230, 118, 0.1)' }}>
                <TrendingUp size={20} style={{ color: 'var(--accent-green)' }} />
              </div>
              <div className={styles.heroLabel}>Total Earned</div>
              <div className={`${styles.heroValue} ${styles.positive}`}>
                {formatCurrency(metrics.totalIncome)}
              </div>
            </div>

            <div className={`card ${styles.heroCard}`}>
              <div className={styles.heroIconWrap} style={{ background: 'var(--error-bg)' }}>
                <TrendingDown size={20} style={{ color: 'var(--error)' }} />
              </div>
              <div className={styles.heroLabel}>Total Spent</div>
              <div className={`${styles.heroValue} ${styles.negative}`}>
                {formatCurrency(metrics.totalExpenses)}
              </div>
            </div>

            <div className={`card ${styles.heroCard}`}>
              <div className={styles.heroIconWrap} style={{ background: 'rgba(0, 230, 118, 0.1)' }}>
                <PiggyBank size={20} style={{ color: 'var(--accent-green)' }} />
              </div>
              <div className={styles.heroLabel}>Total Saved</div>
              <div className={`${styles.heroValue} ${metrics.totalSaved >= 0 ? styles.positive : styles.negative}`}>
                {formatCurrency(metrics.totalSaved)}
              </div>
            </div>

            <div className={`card ${styles.heroCard}`}>
              <div className={styles.heroIconWrap} style={{ background: 'var(--warning-bg)' }}>
                <BarChart3 size={20} style={{ color: 'var(--accent-gold)' }} />
              </div>
              <div className={styles.heroLabel}>Savings Rate</div>
              <div className={`${styles.heroValue} ${styles.goldValue}`}>
                {metrics.savingsRate.toFixed(1)}%
              </div>
            </div>

            <div className={`card ${styles.heroCard}`}>
              <div className={styles.heroIconWrap} style={{ background: 'var(--info-bg)' }}>
                <Wallet size={20} style={{ color: 'var(--info)' }} />
              </div>
              <div className={styles.heroLabel}>Net Worth Change</div>
              <div className={`${styles.heroValue} ${metrics.netWorthChange >= 0 ? styles.positive : styles.negative}`}>
                {formatCurrency(metrics.netWorthChange, true)}
              </div>
            </div>
          </div>

          {/* Monthly Income vs Expense Chart */}
          <div className={`card ${styles.chartCard}`}>
            <h3 className={styles.cardTitle}>
              <BarChart3 size={18} className={styles.cardTitleIcon} />
              Monthly Income vs Expenses
            </h3>
            <div className={styles.chartContainer}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.monthlyData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis
                    dataKey="month"
                    stroke="var(--text-tertiary)"
                    fontSize={12}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="var(--text-tertiary)"
                    fontSize={12}
                    tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="income" name="Income" fill="#00E676" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="expenses" name="Expenses" fill="#FF6B6B" radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Categories and Highlights */}
          <div className={styles.categoriesGrid}>
            {/* Top 5 expense categories */}
            <div className="card">
              <h3 className={styles.cardTitle}>
                <BarChart3 size={18} style={{ color: 'var(--accent-gold)' }} />
                Top Expense Categories
              </h3>
              <div className={styles.categoryList}>
                {metrics.topCategories.map((cat, i) => (
                  <div key={cat.name} className={styles.categoryItem}>
                    <div className={styles.categoryRank} style={{
                      background: `${CHART_COLORS[i]}15`,
                      color: CHART_COLORS[i],
                    }}>
                      {i + 1}
                    </div>
                    <div className={styles.categoryInfo}>
                      <div className={styles.categoryName}>{cat.name}</div>
                      <div className={styles.categoryBar}>
                        <div
                          className={styles.categoryBarFill}
                          style={{
                            width: `${cat.percent}%`,
                            background: CHART_COLORS[i],
                          }}
                        />
                      </div>
                    </div>
                    <div className={styles.categoryAmount}>
                      {formatCurrency(cat.amount)}
                      <span className={styles.categoryPercent}>
                        ({cat.percent.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                ))}
                {metrics.topCategories.length === 0 && (
                  <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
                    No expense data
                  </p>
                )}
              </div>
            </div>

            {/* Investments & extra stats */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="card">
                <h3 className={styles.cardTitle}>
                  <TrendingUp size={18} style={{ color: 'var(--accent-green)' }} />
                  Investments This Year
                </h3>
                <div className={`${styles.heroValue} ${styles.goldValue}`} style={{ fontSize: '1.75rem' }}>
                  {formatCurrency(metrics.totalInvested)}
                </div>
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.8125rem', marginTop: 8 }}>
                  Total invested during {selectedYear}
                </p>
              </div>

              {metrics.bestMonth && (
                <div className="card">
                  <h3 className={styles.cardTitle}>
                    <Trophy size={18} style={{ color: 'var(--accent-green)' }} />
                    Best Savings Month
                  </h3>
                  <div className={styles.highlightItem}>
                    <span className={styles.highlightLabel}>{metrics.bestMonth.month}</span>
                    <span className={`${styles.highlightValue} ${styles.positive}`}>
                      {formatCurrency(metrics.bestMonth.savings)}
                    </span>
                  </div>
                </div>
              )}

              {metrics.worstMonth && (
                <div className="card">
                  <h3 className={styles.cardTitle}>
                    <AlertCircle size={18} style={{ color: 'var(--error)' }} />
                    Worst Savings Month
                  </h3>
                  <div className={styles.highlightItem}>
                    <span className={styles.highlightLabel}>{metrics.worstMonth.month}</span>
                    <span className={`${styles.highlightValue} ${metrics.worstMonth.savings >= 0 ? styles.positive : styles.negative}`}>
                      {formatCurrency(metrics.worstMonth.savings)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Fun stat */}
          {metrics.daysWorthSpent > 0 && (
            <div className={`card ${styles.funStatCard}`}>
              <div className={styles.funStatContent}>
                <div className={styles.funStatEmoji}>🤯</div>
                <div className={styles.funStatText}>
                  You spent{' '}
                  <span className={styles.funStatHighlight}>
                    {metrics.daysWorthSpent} days
                  </span>{' '}
                  worth of income on{' '}
                  <span className={styles.funStatHighlight}>
                    {metrics.topCatName}
                  </span>{' '}
                  this year — that&apos;s{' '}
                  <span className={styles.funStatHighlight}>
                    {formatCurrency(metrics.topCategories[0]?.amount || 0)}
                  </span>!
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
