'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { subscribeTransactions, subscribeIncomeSources, deleteDocument, updateDocument } from '@/lib/firestore';
import { formatCurrency, formatDate } from '@/lib/constants';
import { getCycleForDate, getAvailableMonths, getCurrentCycle } from '@/lib/salaryCycle';
import { Wallet, Trash2, Edit2, TrendingUp, Plus, ChevronDown, Activity, Calendar, Check, X } from 'lucide-react';
import Link from 'next/link';

export default function IncomePage() {
  const { user, userProfile } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [sources, setSources] = useState([]);
  const [editingTx, setEditingTx] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDate, setEditDate] = useState('');
  const [selectedCycleId, setSelectedCycleId] = useState('all');
  const [filterMode, setFilterMode] = useState('cycle'); // 'cycle' | 'month'
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [showCycleDropdown, setShowCycleDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const salaryCycleDay = userProfile?.salaryCycleDay || 28;
  const incomeDates = useMemo(() => {
    return transactions
      .filter(t => t.type === 'income' && t.category === 'Income' && t.date)
      .map(t => new Date(t.date).toISOString())
      .sort();
  }, [transactions]);
  const availableMonths = useMemo(() => getAvailableMonths(salaryCycleDay, incomeDates).reverse(), [salaryCycleDay, incomeDates]);

  // Calendar months from data
  const calendarMonths = useMemo(() => {
    const months = new Set();
    transactions.forEach(t => {
      if (!t.date) return;
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.add(key);
    });
    return [...months].sort().reverse().map(key => {
      const [y, m] = key.split('-');
      const d = new Date(parseInt(y), parseInt(m) - 1, 1);
      return { id: key, label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) };
    });
  }, [transactions]);

  useEffect(() => {
    if (!user) return;
    const u1 = subscribeTransactions(user.uid, setTransactions);
    const u2 = subscribeIncomeSources(user.uid, setSources);
    return () => { u1(); u2(); };
  }, [user]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowCycleDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Filter
  const filteredTransactions = useMemo(() => {
    if (filterMode === 'cycle' && selectedCycleId !== 'all') {
      return transactions.filter(t => {
        if (!t.date) return false;
        const cycle = getCycleForDate(t.date, salaryCycleDay, incomeDates);
        return cycle.id === selectedCycleId;
      });
    }
    if (filterMode === 'month' && selectedMonth !== 'all') {
      return transactions.filter(t => {
        if (!t.date) return false;
        const d = new Date(t.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return key === selectedMonth;
      });
    }
    return transactions;
  }, [transactions, selectedCycleId, selectedMonth, filterMode, salaryCycleDay, incomeDates]);

  const incomeEntries = filteredTransactions.filter(t => t.type === 'income');
  const totalIncome = incomeEntries.reduce((s, t) => s + (t.amount || 0), 0);

  // Per-source analysis
  const bySource = {};
  incomeEntries.forEach(t => {
    const src = t.category || 'Other';
    if (!bySource[src]) bySource[src] = { total: 0, entries: [] };
    bySource[src].total += t.amount || 0;
    bySource[src].entries.push(t);
  });

  const expensesBySource = {};
  filteredTransactions.filter(t => t.type === 'expense').forEach(t => {
    const src = t.fundingSource || '';
    if (src) expensesBySource[src] = (expensesBySource[src] || 0) + (t.amount || 0);
  });

  // Monthly trend data
  const monthlyBreakdown = useMemo(() => {
    const months = {};
    transactions.forEach(t => {
      if (!t.date) return;
      const cycle = getCycleForDate(t.date, salaryCycleDay, incomeDates);
      const key = cycle.id;
      if (!months[key]) months[key] = { label: cycle.label, id: key, income: {}, expenses: {} };

      if (t.type === 'income') {
        const src = t.category || 'Other';
        months[key].income[src] = (months[key].income[src] || 0) + (t.amount || 0);
      }
      if (t.type === 'expense' && t.fundingSource) {
        months[key].expenses[t.fundingSource] = (months[key].expenses[t.fundingSource] || 0) + (t.amount || 0);
      }
    });
    return Object.values(months).sort((a, b) => b.id.localeCompare(a.id));
  }, [transactions, salaryCycleDay, incomeDates]);

  const handleEditSave = async (txId) => {
    const updates = {};
    if (editAmount) {
      const newAmt = parseFloat(editAmount);
      if (newAmt > 0) updates.amount = newAmt;
    }
    if (editCategory) updates.category = editCategory;
    if (editDate) updates.date = editDate;
    if (Object.keys(updates).length > 0) {
      await updateDocument(user.uid, 'transactions', txId, updates);
    }
    setEditingTx(null);
    setEditAmount('');
    setEditCategory('');
    setEditDate('');
  };

  const startEdit = (t) => {
    setEditingTx(t.id);
    setEditAmount(String(t.amount));
    setEditCategory(t.category || 'Income');
    setEditDate(t.date || '');
  };

  const filterLabel = filterMode === 'cycle'
    ? (selectedCycleId === 'all' ? 'All Time' : (availableMonths.find(c => c.id === selectedCycleId)?.label || 'All Time'))
    : (selectedMonth === 'all' ? 'All Months' : (calendarMonths.find(m => m.id === selectedMonth)?.label || 'All Months'));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Income</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: 4 }}>
            {filterLabel} • Total: <span className="currency-positive">{formatCurrency(totalIncome)}</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
          {/* Filter mode toggle */}
          <div style={{ display: 'flex', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
            <button onClick={() => { setFilterMode('cycle'); setSelectedMonth('all'); }}
              style={{
                padding: '6px 12px', fontSize: '0.75rem', fontWeight: 600, border: 'none', cursor: 'pointer',
                background: filterMode === 'cycle' ? 'var(--accent-green)' : 'var(--bg-surface)',
                color: filterMode === 'cycle' ? '#0B0F1A' : 'var(--text-secondary)',
              }}>Salary Cycle</button>
            <button onClick={() => { setFilterMode('month'); setSelectedCycleId('all'); }}
              style={{
                padding: '6px 12px', fontSize: '0.75rem', fontWeight: 600, border: 'none', cursor: 'pointer',
                background: filterMode === 'month' ? 'var(--accent-green)' : 'var(--bg-surface)',
                color: filterMode === 'month' ? '#0B0F1A' : 'var(--text-secondary)',
              }}>Calendar Month</button>
          </div>

          {/* Dropdown selector */}
          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <button
              onClick={() => setShowCycleDropdown(!showCycleDropdown)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.875rem',
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}>
              <Activity size={16} />
              {filterLabel}
              <ChevronDown size={16} style={{ transform: showCycleDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>
            {showCycleDropdown && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 4px)', right: 0,
                background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', zIndex: 100,
                maxHeight: 320, overflowY: 'auto', minWidth: 200, padding: '4px 0',
              }}>
                <button
                  onClick={() => { filterMode === 'cycle' ? setSelectedCycleId('all') : setSelectedMonth('all'); setShowCycleDropdown(false); }}
                  style={{
                    display: 'block', width: '100%', padding: '10px 16px', textAlign: 'left',
                    fontSize: '0.875rem', fontWeight: 700,
                    color: 'var(--accent-green)', background: 'transparent', border: 'none', cursor: 'pointer',
                  }}>
                  {filterMode === 'cycle' ? 'All Time' : 'All Months'}
                </button>
                {(filterMode === 'cycle' ? availableMonths : calendarMonths).map(item => {
                  const isActive = filterMode === 'cycle' ? selectedCycleId === item.id : selectedMonth === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { filterMode === 'cycle' ? setSelectedCycleId(item.id) : setSelectedMonth(item.id); setShowCycleDropdown(false); }}
                      style={{
                        display: 'block', width: '100%', padding: '10px 16px', textAlign: 'left',
                        fontSize: '0.875rem', fontWeight: isActive ? 700 : 500,
                        color: isActive ? 'var(--accent-green)' : 'var(--text-secondary)',
                        background: isActive ? 'var(--success-bg)' : 'transparent',
                        border: 'none', cursor: 'pointer',
                      }}>
                      {item.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <Link href="/add" className="btn btn-primary"><Plus size={16} /> Add Income</Link>
        </div>
      </div>

      {/* Per-Source Balance Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
        {Object.entries(bySource).map(([source, data]) => {
          const spent = expensesBySource[source] || 0;
          const remaining = data.total - spent;
          const usedPct = data.total > 0 ? (spent / data.total) * 100 : 0;
          return (
            <div key={source} className="card" style={{ borderColor: remaining > 0 ? 'rgba(0,230,118,0.1)' : 'rgba(255,77,79,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Wallet size={22} style={{ color: 'var(--accent-green)' }} />
                </div>
                <div>
                  <div style={{ fontSize: '1.125rem', fontWeight: 800 }}>{source}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{data.entries.length} entries • {filterLabel}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 4 }}>Earned</div>
                  <div className="currency-positive" style={{ fontWeight: 800, fontSize: '1.125rem' }}>{formatCurrency(data.total)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 4 }}>Spent</div>
                  <div className="currency-negative" style={{ fontWeight: 800, fontSize: '1.125rem' }}>{formatCurrency(spent)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 4 }}>Remaining</div>
                  <div style={{ fontWeight: 800, fontSize: '1.125rem', color: remaining >= 0 ? 'var(--accent-green)' : 'var(--error)', textShadow: remaining >= 0 ? 'var(--glow-green)' : 'none' }}>{formatCurrency(remaining)}</div>
                </div>
              </div>
              <div className="progress-bar" style={{ marginTop: 16, height: 8 }}>
                <div className={`progress-bar-fill ${usedPct > 90 ? 'danger' : ''}`} style={{ width: `${Math.min(100, usedPct)}%` }} />
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', marginTop: 4, textAlign: 'right' }}>
                {usedPct.toFixed(1)}% used
              </div>
            </div>
          );
        })}
        {Object.keys(bySource).length === 0 && (
          <div className="card empty-state" style={{ gridColumn: '1 / -1' }}>
            <Wallet size={40} />
            <h3>No income entries {filterLabel !== 'All Time' && filterLabel !== 'All Months' ? 'for this period' : ''}</h3>
            <Link href="/add" className="btn btn-primary">Add Income</Link>
          </div>
        )}
      </div>

      {/* Monthly Breakdown Table */}
      {((filterMode === 'cycle' && selectedCycleId === 'all') || (filterMode === 'month' && selectedMonth === 'all')) && monthlyBreakdown.length > 0 && (
        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={18} style={{ color: 'var(--text-tertiary)' }} />
            Cycle-wise Balance Breakdown
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.6875rem' }}>Cycle</th>
                  {['Income', 'Income 2.0'].map(src => (
                    <th key={src} colSpan={3} style={{ textAlign: 'center', padding: '10px 8px', fontWeight: 700, color: 'var(--text-secondary)', borderLeft: '1px solid var(--border-color)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.6875rem' }}>{src}</th>
                  ))}
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <th></th>
                  {['Income', 'Income 2.0'].map(src => [
                    <th key={`${src}-e`} style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 600, fontSize: '0.625rem', color: 'var(--accent-green)', borderLeft: '1px solid var(--border-color)' }}>Earned</th>,
                    <th key={`${src}-s`} style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 600, fontSize: '0.625rem', color: 'var(--error)' }}>Spent</th>,
                    <th key={`${src}-r`} style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 600, fontSize: '0.625rem', color: 'var(--accent-gold)' }}>Balance</th>,
                  ])}
                </tr>
              </thead>
              <tbody>
                {monthlyBreakdown.map((month) => (
                  <tr key={month.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{month.label}</td>
                    {['Income', 'Income 2.0'].map(src => {
                      const earned = month.income[src] || 0;
                      const spent = month.expenses[src] || 0;
                      const balance = earned - spent;
                      return [
                        <td key={`${month.id}-${src}-e`} style={{ textAlign: 'right', padding: '10px 8px', color: 'var(--accent-green)', fontWeight: 600, borderLeft: '1px solid var(--border-color)' }}>{earned > 0 ? formatCurrency(earned) : '—'}</td>,
                        <td key={`${month.id}-${src}-s`} style={{ textAlign: 'right', padding: '10px 8px', color: 'var(--error)', fontWeight: 600 }}>{spent > 0 ? formatCurrency(spent) : '—'}</td>,
                        <td key={`${month.id}-${src}-r`} style={{ textAlign: 'right', padding: '10px 8px', fontWeight: 800, color: balance >= 0 ? 'var(--accent-green)' : 'var(--error)' }}>{earned > 0 || spent > 0 ? formatCurrency(balance) : '—'}</td>,
                      ];
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Income Entries List */}
      <div className="card">
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 'var(--space-4)' }}>All Income Entries</h3>
        {incomeEntries.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {incomeEntries.map(t => (
              <div key={t.id} style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)', transition: 'background 0.15s'
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingUp size={16} style={{ color: 'var(--accent-green)' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {t.category || t.description}
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', fontWeight: 400 }}>
                      {t.category === 'Income 2.0' ? '2.0' : ''}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                    {formatDate(t.date, 'medium')} {t.salaryCycleLabel ? `• ${t.salaryCycleLabel}` : ''}
                  </div>
                </div>
                {editingTx === t.id ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                      style={{ height: 32, fontSize: '0.8125rem', padding: '0 8px' }} />
                    <select value={editCategory} onChange={e => setEditCategory(e.target.value)}
                      style={{ height: 32, fontSize: '0.8125rem', minWidth: 120, padding: '0 8px' }}>
                      <option value="Income">Income</option>
                      <option value="Income 2.0">Income 2.0</option>
                    </select>
                    <input type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)}
                      style={{ width: 100, height: 32, fontSize: '0.875rem', textAlign: 'right' }} autoFocus />
                    <button className="btn btn-primary btn-sm" onClick={() => handleEditSave(t.id)} style={{ height: 32, padding: '0 12px' }}>
                      <Check size={14} />
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditingTx(null)} style={{ height: 32, padding: '0 8px' }}>
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="currency-positive" style={{ fontWeight: 800 }}>+{formatCurrency(t.amount)}</div>
                    <button style={{ color: 'var(--text-tertiary)', padding: 4 }}
                      onClick={() => startEdit(t)}>
                      <Edit2 size={14} />
                    </button>
                    <button style={{ color: 'var(--text-tertiary)', padding: 4 }}
                      onClick={() => { if (confirm('Delete?')) deleteDocument(user.uid, 'transactions', t.id); }}>
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Wallet size={40} />
            <h3>No income entries {filterLabel !== 'All Time' && filterLabel !== 'All Months' ? 'for this period' : ''}</h3>
            <Link href="/add" className="btn btn-primary">Add Income</Link>
          </div>
        )}
      </div>
    </div>
  );
}
