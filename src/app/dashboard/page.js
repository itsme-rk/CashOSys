'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  subscribeTransactions,
  subscribeInvestments,
  subscribeEmergencyFund,
  subscribeGoals,
  subscribeLoans,
  subscribeLending,
  subscribeIncomeSources,
} from '@/lib/firestore';
import { getCurrentCycle, getCycleForDate, getAvailableMonths } from '@/lib/salaryCycle';
import { formatCurrency, formatPercent, formatDate } from '@/lib/constants';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  PiggyBank,
  Target,
  Brain,
  ChevronDown,
  BarChart3,
  DollarSign,
  Shield,
  Activity,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar,
} from 'recharts';
import styles from './dashboard.module.css';

const CHART_COLORS = [
  '#00E676', '#D4AF37', '#FF6B6B', '#448AFF', '#BB8FCE',
  '#F7DC6F', '#4ECDC4', '#F8C471', '#82E0AA', '#85C1E9',
  '#F0B27A', '#AED6F1', '#F1948A', '#D7BDE2', '#76D7C4',
];

export default function DashboardPage() {
  const { user, userProfile } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [emergencyFund, setEmergencyFund] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loans, setLoans] = useState([]);
  const [lending, setLending] = useState([]);
  const [incomeSources, setIncomeSources] = useState([]);
  const [selectedCycleId, setSelectedCycleId] = useState(null);
  const [showCycleDropdown, setShowCycleDropdown] = useState(false);

  const salaryCycleDay = userProfile?.salaryCycleDay || 28;

  // Subscribe to all data
  useEffect(() => {
    if (!user) return;
    const unsubs = [
      subscribeTransactions(user.uid, setTransactions),
      subscribeInvestments(user.uid, setInvestments),
      subscribeEmergencyFund(user.uid, setEmergencyFund),
      subscribeGoals(user.uid, setGoals),
      subscribeLoans(user.uid, setLoans),
      subscribeLending(user.uid, setLending),
      subscribeIncomeSources(user.uid, setIncomeSources),
    ];
    return () => unsubs.forEach(u => u());
  }, [user]);

  // Set default cycle
  useEffect(() => {
    if (!selectedCycleId) {
      const current = getCurrentCycle(salaryCycleDay);
      setSelectedCycleId(current.id);
    }
  }, [salaryCycleDay, selectedCycleId]);

  const availableMonths = useMemo(() => getAvailableMonths(salaryCycleDay), [salaryCycleDay]);
  const currentCycle = availableMonths.find(c => c.id === selectedCycleId) || getCurrentCycle(salaryCycleDay);

  // Computed metrics
  const metrics = useMemo(() => {
    const cycleTransactions = transactions.filter(t => {
      if (!t.date) return false;
      const cycle = getCycleForDate(t.date, salaryCycleDay);
      return cycle.id === selectedCycleId;
    });

    const income = cycleTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const expenses = cycleTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const balance = income - expenses;
    const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;

    // Category breakdown
    const categoryMap = {};
    cycleTransactions.filter(t => t.type === 'expense').forEach(t => {
      const cat = t.category || 'Misc';
      categoryMap[cat] = (categoryMap[cat] || 0) + (t.amount || 0);
    });
    const categoryData = Object.entries(categoryMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Per-source balance
    const sourceBalances = {};
    cycleTransactions.forEach(t => {
      const source = t.fundingSource || (t.type === 'income' ? t.category : '');
      if (!source) return;
      if (!sourceBalances[source]) sourceBalances[source] = { income: 0, expenses: 0 };
      if (t.type === 'income') sourceBalances[source].income += t.amount || 0;
      if (t.type === 'expense') sourceBalances[source].expenses += t.amount || 0;
    });

    // Total portfolio value
    const totalInvested = investments.reduce((sum, i) => sum + (i.investedAmount || 0) - (i.withdrawal || 0), 0);
    const totalCurrentValue = investments.reduce((sum, i) => sum + (i.currentValue || i.investedAmount || 0), 0);
    const investmentGain = totalCurrentValue - totalInvested;

    // Emergency fund balance
    const efBalance = emergencyFund.reduce((sum, e) => sum + (e.amount || 0), 0);

    // Goals progress
    const totalGoalTarget = goals.reduce((sum, g) => sum + (g.targetAmount || 0), 0);
    const totalGoalSaved = goals.reduce((sum, g) => sum + (g.savedAmount || 0), 0);

    // Loans remaining
    const totalLoanRemaining = loans.reduce((sum, l) => sum + ((l.totalAmount || 0) - (l.paidTillDate || 0)), 0);

    // Lending outstanding
    const lendingOutstanding = lending
      .filter(l => l.status === 'waiting' || l.status === 'partial')
      .reduce((sum, l) => sum + (l.amount || 0), 0);

    // Net worth
    const netWorth = balance + totalCurrentValue + efBalance + totalGoalSaved - totalLoanRemaining;

    // Monthly average expenses (from all transactions)
    const allExpenses = transactions.filter(t => t.type === 'expense');
    const avgMonthlyExpense = allExpenses.length > 0 
      ? allExpenses.reduce((sum, t) => sum + (t.amount || 0), 0) / Math.max(1, new Set(allExpenses.map(t => {
          const d = new Date(t.date);
          return `${d.getFullYear()}-${d.getMonth()}`;
        })).size)
      : 0;
    const survivalMonths = avgMonthlyExpense > 0 ? efBalance / avgMonthlyExpense : 0;

    return {
      income, expenses, balance, savingsRate, categoryData,
      sourceBalances, totalInvested, totalCurrentValue, investmentGain,
      efBalance, survivalMonths, totalGoalTarget, totalGoalSaved,
      totalLoanRemaining, lendingOutstanding, netWorth,
      recentTransactions: cycleTransactions.slice(0, 8),
    };
  }, [transactions, investments, emergencyFund, goals, loans, lending, selectedCycleId, salaryCycleDay]);

  // Monthly trend data
  const trendData = useMemo(() => {
    const months = {};
    transactions.forEach(t => {
      if (!t.date) return;
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short' });
      if (!months[key]) months[key] = { month: label, income: 0, expenses: 0 };
      if (t.type === 'income') months[key].income += t.amount || 0;
      if (t.type === 'expense') months[key].expenses += t.amount || 0;
    });
    return Object.values(months).slice(-6);
  }, [transactions]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload) return null;
    return (
      <div className={styles.chartTooltip}>
        <p className={styles.tooltipLabel}>{label}</p>
        {payload.map((entry, i) => (
          <p key={i} style={{ color: entry.color }}>
            {entry.name}: {formatCurrency(entry.value)}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className={styles.dashboard}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.greeting}>
            Welcome back, <span>{user?.displayName?.split(' ')[0] || 'User'}</span> 👋
          </h1>
          <p className={styles.subtitle}>Here's your financial overview</p>
        </div>
        
        {/* Cycle Selector */}
        <div className={styles.cycleSelector}>
          <button
            className={styles.cycleSelectorBtn}
            onClick={() => setShowCycleDropdown(!showCycleDropdown)}
          >
            <Activity size={16} />
            <span>{currentCycle.label}</span>
            <ChevronDown size={16} />
          </button>
          {showCycleDropdown && (
            <div className={styles.cycleDropdown}>
              {availableMonths.map(cycle => (
                <button
                  key={cycle.id}
                  className={`${styles.cycleOption} ${cycle.id === selectedCycleId ? styles.cycleActive : ''}`}
                  onClick={() => { setSelectedCycleId(cycle.id); setShowCycleDropdown(false); }}
                >
                  {cycle.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Hero Stats */}
      <div className={styles.heroStats}>
        <div className={`card ${styles.heroCard} ${styles.balanceCard}`}>
          <div className={styles.heroIcon}>
            <Wallet size={24} />
          </div>
          <div className={styles.heroLabel}>Net Balance</div>
          <div className={`${styles.heroValue} ${metrics.balance >= 0 ? 'currency-positive' : 'currency-negative'}`}>
            {formatCurrency(metrics.balance)}
          </div>
          <div className={`${styles.heroChange} ${metrics.savingsRate >= 0 ? styles.positive : styles.negative}`}>
            {metrics.savingsRate >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {formatPercent(metrics.savingsRate)} savings rate
          </div>
        </div>

        <div className={`card ${styles.heroCard}`}>
          <div className={`${styles.heroIcon} ${styles.incomeIcon}`}>
            <TrendingUp size={24} />
          </div>
          <div className={styles.heroLabel}>Total Income</div>
          <div className={`${styles.heroValue} currency-positive`}>
            {formatCurrency(metrics.income)}
          </div>
        </div>

        <div className={`card ${styles.heroCard}`}>
          <div className={`${styles.heroIcon} ${styles.expenseIcon}`}>
            <TrendingDown size={24} />
          </div>
          <div className={styles.heroLabel}>Total Expenses</div>
          <div className={`${styles.heroValue} currency-negative`}>
            {formatCurrency(metrics.expenses)}
          </div>
        </div>

        <div className={`card ${styles.heroCard}`}>
          <div className={`${styles.heroIcon} ${styles.netWorthIcon}`}>
            <DollarSign size={24} />
          </div>
          <div className={styles.heroLabel}>Net Worth</div>
          <div className={`${styles.heroValue} ${styles.goldValue}`}>
            {formatCurrency(metrics.netWorth)}
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className={styles.chartsRow}>
        {/* Category Pie Chart */}
        <div className={`card ${styles.chartCard}`}>
          <h3 className={styles.cardTitle}>
            <BarChart3 size={18} />
            Spending by Category
          </h3>
          {metrics.categoryData.length > 0 ? (
            <div className={styles.pieChartContainer}>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={metrics.categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {metrics.categoryData.map((_, idx) => (
                      <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
              <div className={styles.categoryLegend}>
                {metrics.categoryData.slice(0, 6).map((cat, idx) => (
                  <div key={cat.name} className={styles.legendItem}>
                    <span className={styles.legendDot} style={{ background: CHART_COLORS[idx % CHART_COLORS.length] }} />
                    <span className={styles.legendName}>{cat.name}</span>
                    <span className={styles.legendValue}>{formatCurrency(cat.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <BarChart3 size={40} />
              <p>No expenses this cycle</p>
            </div>
          )}
        </div>

        {/* Monthly Trend */}
        <div className={`card ${styles.chartCard}`}>
          <h3 className={styles.cardTitle}>
            <Activity size={18} />
            Monthly Trend
          </h3>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00E676" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00E676" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="redGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF4D4F" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#FF4D4F" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="month" stroke="var(--text-tertiary)" fontSize={12} />
                <YAxis stroke="var(--text-tertiary)" fontSize={12} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="income" stroke="#00E676" fill="url(#greenGrad)" strokeWidth={2} name="Income" />
                <Area type="monotone" dataKey="expenses" stroke="#FF4D4F" fill="url(#redGrad)" strokeWidth={2} name="Expenses" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state">
              <Activity size={40} />
              <p>Add transactions to see trends</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className={styles.bottomRow}>
        {/* Quick Stats */}
        <div className={styles.quickStats}>
          <div className={`card card-compact ${styles.miniCard}`}>
            <div className={styles.miniHeader}>
              <Shield size={16} className="text-green" />
              <span>Emergency Fund</span>
            </div>
            <div className={styles.miniValue}>{formatCurrency(metrics.efBalance)}</div>
            <div className={styles.miniSub}>{metrics.survivalMonths.toFixed(1)} months survival</div>
          </div>

          <div className={`card card-compact ${styles.miniCard}`}>
            <div className={styles.miniHeader}>
              <TrendingUp size={16} className="text-gold" />
              <span>Investments</span>
            </div>
            <div className={styles.miniValue}>{formatCurrency(metrics.totalCurrentValue)}</div>
            <div className={`${styles.miniSub} ${metrics.investmentGain >= 0 ? 'text-green' : 'text-error'}`}>
              {formatCurrency(metrics.investmentGain, true)} gain
            </div>
          </div>

          <div className={`card card-compact ${styles.miniCard}`}>
            <div className={styles.miniHeader}>
              <Target size={16} style={{ color: '#448AFF' }} />
              <span>Goals</span>
            </div>
            <div className={styles.miniValue}>{formatCurrency(metrics.totalGoalSaved)}</div>
            <div className={styles.miniSub}>of {formatCurrency(metrics.totalGoalTarget)} target</div>
          </div>

          <div className={`card card-compact ${styles.miniCard}`}>
            <div className={styles.miniHeader}>
              <PiggyBank size={16} style={{ color: '#BB8FCE' }} />
              <span>Lending Out</span>
            </div>
            <div className={styles.miniValue}>{formatCurrency(metrics.lendingOutstanding)}</div>
            <div className={styles.miniSub}>{lending.filter(l => l.status === 'waiting').length} pending</div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className={`card ${styles.recentCard}`}>
          <h3 className={styles.cardTitle}>Recent Transactions</h3>
          <div className={styles.transactionList}>
            {metrics.recentTransactions.length > 0 ? (
              metrics.recentTransactions.map((t, i) => (
                <div key={t.id || i} className={styles.transactionItem} style={{ animationDelay: `${i * 50}ms` }}>
                  <div className={styles.txCategory}>
                    <span className={styles.txIcon}>{t.type === 'income' ? '💰' : getCategoryEmoji(t.category)}</span>
                  </div>
                  <div className={styles.txDetails}>
                    <span className={styles.txDesc}>{t.description || t.category}</span>
                    <span className={styles.txMeta}>
                      {formatDate(t.date)} • {t.fundingSource || t.category}
                    </span>
                  </div>
                  <div className={`${styles.txAmount} ${t.type === 'income' ? 'currency-positive' : 'currency-negative'}`}>
                    {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <Wallet size={32} />
                <p>No transactions this cycle</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getCategoryEmoji(category) {
  const map = {
    'Food': '🍔', 'House': '🏠', 'Fuel': '⛽', 'Transport': '🚗',
    'GYM': '🏋️', 'Shopping': '🛍️', 'Personal': '👤', 'Electronics': '📱',
    'Doctor/Medicine': '💊', 'Internet': '🌐', 'Gold': '🥇', 'FD': '🏦',
    'Stocks': '📊', 'Subscriptions': '📺', 'Misc': '📌',
  };
  return map[category] || '📌';
}
