'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
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
import { getDashboardData } from '@/lib/dashboardCache';
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
  const cycleDropdownRef = useRef(null);

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

  const incomeDates = useMemo(() => {
    return transactions
      .filter(t => t.type === 'income' && t.category === 'Income' && t.date)
      .map(t => new Date(t.date).toISOString())
      .sort();
  }, [transactions]);

  // Set default cycle
  useEffect(() => {
    if (!selectedCycleId) {
      const current = getCurrentCycle(salaryCycleDay);
      setSelectedCycleId(current.id);
    }
  }, [salaryCycleDay, selectedCycleId]);

  const availableMonths = useMemo(() => getAvailableMonths(salaryCycleDay, incomeDates).reverse(), [salaryCycleDay, incomeDates]);
  const currentCycle = availableMonths.find(c => c.id === selectedCycleId) || getCurrentCycle(salaryCycleDay);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (cycleDropdownRef.current && !cycleDropdownRef.current.contains(e.target)) {
        setShowCycleDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Computed metrics using unified cache layer
  const metrics = useMemo(() => {
    return getDashboardData({
      transactions,
      investments,
      efEntries: emergencyFund,
      goals,
      loans,
      lending,
      salaryCycleDay,
      incomeDates,
      selectedCycleId,
      getCycleForDate,
    });
  }, [transactions, investments, emergencyFund, goals, loans, lending, selectedCycleId, salaryCycleDay, incomeDates]);

  // Use trendData directly from metrics
  const trendData = metrics.trendData;

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
        <div className={styles.cycleSelector} ref={cycleDropdownRef}>
          <button
            className={styles.cycleSelectorBtn}
            onClick={() => setShowCycleDropdown(!showCycleDropdown)}
          >
            <Activity size={16} />
            <span>{currentCycle.label}</span>
            <ChevronDown size={16} style={{ transform: showCycleDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
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
                    data={metrics.categoryChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {metrics.categoryChartData.map((_, idx) => (
                      <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
              <div className={styles.categoryLegend}>
                {metrics.categoryChartData.slice(0, 6).map((cat, idx) => (
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
            <div className={styles.miniValue}>{formatCurrency(metrics.totalLendingOutstanding)}</div>
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

        {/* Fuel This Cycle Widget — only shows if fuel entries exist */}
        {metrics.fuelStats && (
          <div className="card" style={{ padding: 'var(--space-4)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, marginBottom: 16, fontSize: '1rem' }}>
              ⛽ Fuel This Cycle
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>Spend</div>
                <div style={{ fontWeight: 800, color: 'var(--error)' }}>{formatCurrency(metrics.fuelStats.totalSpend)}</div>
              </div>
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>Litres</div>
                <div style={{ fontWeight: 800 }}>{metrics.fuelStats.totalLitres?.toFixed(1)}L</div>
              </div>
              {metrics.fuelStats.avgMileage && (
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>Avg Mileage</div>
                  <div style={{ fontWeight: 800, color: 'var(--accent-green)' }}>{metrics.fuelStats.avgMileage?.toFixed(1)} km/L</div>
                </div>
              )}
              {metrics.fuelStats.costPerKm && (
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>Cost/km</div>
                  <div style={{ fontWeight: 800 }}>₹{metrics.fuelStats.costPerKm?.toFixed(2)}</div>
                </div>
              )}
            </div>
          </div>
        )}
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
