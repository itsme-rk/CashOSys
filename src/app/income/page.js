'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { subscribeTransactions, subscribeIncomeSources, deleteDocument, updateDocument } from '@/lib/firestore';
import { formatCurrency, formatDate } from '@/lib/constants';
import { getCycleForDate, getAvailableMonths, getCurrentCycle } from '@/lib/salaryCycle';
import { Wallet, Trash2, Edit2, TrendingUp, Plus, ChevronDown, Activity, Calendar } from 'lucide-react';
import Link from 'next/link';

export default function IncomePage() {
  const { user, userProfile } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [sources, setSources] = useState([]);
  const [editingTx, setEditingTx] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [selectedCycleId, setSelectedCycleId] = useState('all');
  const [showCycleDropdown, setShowCycleDropdown] = useState(false);

  const salaryCycleDay = userProfile?.salaryCycleDay || 28;
  const availableMonths = useMemo(() => getAvailableMonths(salaryCycleDay), [salaryCycleDay]);

  useEffect(() => {
    if (!user) return;
    const u1 = subscribeTransactions(user.uid, setTransactions);
    const u2 = subscribeIncomeSources(user.uid, setSources);
    return () => { u1(); u2(); };
  }, [user]);

  // Filter by cycle
  const filteredTransactions = useMemo(() => {
    if (selectedCycleId === 'all') return transactions;
    return transactions.filter(t => {
      if (!t.date) return false;
      const cycle = getCycleForDate(t.date, salaryCycleDay);
      return cycle.id === selectedCycleId;
    });
  }, [transactions, selectedCycleId, salaryCycleDay]);

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

  // Monthly trend data for ALL-TIME (source-wise)
  const monthlyBreakdown = useMemo(() => {
    const months = {};
    transactions.forEach(t => {
      if (!t.date) return;
      const cycle = getCycleForDate(t.date, salaryCycleDay);
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
    return Object.values(months).reverse();
  }, [transactions, salaryCycleDay]);

  const handleEditSave = async (txId, currentAmount) => {
    const newAmt = parseFloat(editAmount);
    if (newAmt > 0 && newAmt !== currentAmount) {
      await updateDocument(user.uid, 'transactions', txId, { amount: newAmt });
    }
    setEditingTx(null);
    setEditAmount('');
  };

  const cycleLabel = selectedCycleId === 'all' ? 'All Time' : (availableMonths.find(c => c.id === selectedCycleId)?.label || 'All Time');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Income</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: 4 }}>
            {cycleLabel} • Total: <span className="currency-positive">{formatCurrency(totalIncome)}</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
          {/* Cycle Selector */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowCycleDropdown(!showCycleDropdown)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.875rem',
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              <Activity size={16} />
              {cycleLabel}
              <ChevronDown size={16} />
            </button>
            {showCycleDropdown && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 8,
                background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', zIndex: 50,
                maxHeight: 300, overflowY: 'auto', minWidth: 180,
              }}>
                <button
                  onClick={() => { setSelectedCycleId('all'); setShowCycleDropdown(false); }}
                  style={{
                    display: 'block', width: '100%', padding: '10px 16px', textAlign: 'left',
                    fontSize: '0.875rem', fontWeight: selectedCycleId === 'all' ? 700 : 500,
                    color: selectedCycleId === 'all' ? 'var(--accent-green)' : 'var(--text-secondary)',
                    background: selectedCycleId === 'all' ? 'var(--success-bg)' : 'transparent',
                    border: 'none', cursor: 'pointer',
                  }}
                >
                  All Time
                </button>
                {availableMonths.map(cycle => (
                  <button
                    key={cycle.id}
                    onClick={() => { setSelectedCycleId(cycle.id); setShowCycleDropdown(false); }}
                    style={{
                      display: 'block', width: '100%', padding: '10px 16px', textAlign: 'left',
                      fontSize: '0.875rem', fontWeight: selectedCycleId === cycle.id ? 700 : 500,
                      color: selectedCycleId === cycle.id ? 'var(--accent-green)' : 'var(--text-secondary)',
                      background: selectedCycleId === cycle.id ? 'var(--success-bg)' : 'transparent',
                      border: 'none', cursor: 'pointer',
                    }}
                  >
                    {cycle.label}
                  </button>
                ))}
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
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{data.entries.length} entries • {cycleLabel}</div>
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
            <h3>No income entries {selectedCycleId !== 'all' ? 'this cycle' : ''}</h3>
            <Link href="/add" className="btn btn-primary">Add Income</Link>
          </div>
        )}
      </div>

      {/* Monthly Breakdown Table */}
      {selectedCycleId === 'all' && monthlyBreakdown.length > 0 && (
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
                  {['Income', 'Income 2.0'].map(src => (
                    <>
                      <th key={`${src}-e`} style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 600, fontSize: '0.625rem', color: 'var(--accent-green)', borderLeft: '1px solid var(--border-color)' }}>Earned</th>
                      <th key={`${src}-s`} style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 600, fontSize: '0.625rem', color: 'var(--error)' }}>Spent</th>
                      <th key={`${src}-r`} style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 600, fontSize: '0.625rem', color: 'var(--accent-gold)' }}>Balance</th>
                    </>
                  ))}
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
                      return (
                        <>
                          <td key={`${src}-e`} style={{ textAlign: 'right', padding: '10px 8px', color: 'var(--accent-green)', fontWeight: 600, borderLeft: '1px solid var(--border-color)' }}>{earned > 0 ? formatCurrency(earned) : '—'}</td>
                          <td key={`${src}-s`} style={{ textAlign: 'right', padding: '10px 8px', color: 'var(--error)', fontWeight: 600 }}>{spent > 0 ? formatCurrency(spent) : '—'}</td>
                          <td key={`${src}-r`} style={{ textAlign: 'right', padding: '10px 8px', fontWeight: 800, color: balance >= 0 ? 'var(--accent-green)' : 'var(--error)' }}>{earned > 0 || spent > 0 ? formatCurrency(balance) : '—'}</td>
                        </>
                      );
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
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{t.category || t.description}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                    {formatDate(t.date, 'medium')} {t.salaryCycleLabel ? `• ${t.salaryCycleLabel}` : ''}
                  </div>
                </div>
                {editingTx === t.id ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)} style={{ width: 100, height: 32, fontSize: '0.875rem', textAlign: 'right' }} autoFocus />
                    <button className="btn btn-primary btn-sm" onClick={() => handleEditSave(t.id, t.amount)}>Save</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditingTx(null)}>✕</button>
                  </div>
                ) : (
                  <>
                    <div className="currency-positive" style={{ fontWeight: 800 }}>+{formatCurrency(t.amount)}</div>
                    <button style={{ color: 'var(--text-tertiary)', padding: 4 }}
                      onClick={() => { setEditingTx(t.id); setEditAmount(String(t.amount)); }}>
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
            <h3>No income entries {selectedCycleId !== 'all' ? 'this cycle' : ''}</h3>
            <Link href="/add" className="btn btn-primary">Add Income</Link>
          </div>
        )}
      </div>
    </div>
  );
}
