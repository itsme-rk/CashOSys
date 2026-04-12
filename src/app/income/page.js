'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { subscribeTransactions, subscribeIncomeSources, deleteDocument } from '@/lib/firestore';
import { formatCurrency, formatDate } from '@/lib/constants';
import EditTransactionModal from '@/components/EditTransactionModal';
import { Wallet, Trash2, Edit2, TrendingUp, Plus } from 'lucide-react';
import Link from 'next/link';

export default function IncomePage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [sources, setSources] = useState([]);
  const [editingTx, setEditingTx] = useState(null);

  useEffect(() => {
    if (!user) return;
    const u1 = subscribeTransactions(user.uid, setTransactions);
    const u2 = subscribeIncomeSources(user.uid, setSources);
    return () => { u1(); u2(); };
  }, [user]);

  const incomeEntries = transactions.filter(t => t.type === 'income');
  const totalIncome = incomeEntries.reduce((s, t) => s + (t.amount || 0), 0);

  const bySource = {};
  incomeEntries.forEach(t => {
    const src = t.category || 'Other';
    if (!bySource[src]) bySource[src] = { total: 0, entries: [] };
    bySource[src].total += t.amount || 0;
    bySource[src].entries.push(t);
  });

  const expensesBySource = {};
  transactions.filter(t => t.type === 'expense').forEach(t => {
    const src = t.fundingSource || '';
    if (src) expensesBySource[src] = (expensesBySource[src] || 0) + (t.amount || 0);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Income</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: 4 }}>
            Total: <span className="currency-positive">{formatCurrency(totalIncome)}</span>
          </p>
        </div>
        <Link href="/add" className="btn btn-primary"><Plus size={16} /> Add Income</Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
        {Object.entries(bySource).map(([source, data]) => {
          const spent = expensesBySource[source] || 0;
          const remaining = data.total - spent;
          return (
            <div key={source} className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Wallet size={20} style={{ color: 'var(--accent-green)' }} />
                </div>
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 700 }}>{source}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{data.entries.length} entries</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)', textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Earned</div>
                  <div className="currency-positive" style={{ fontWeight: 800, fontSize: '1rem' }}>{formatCurrency(data.total)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Spent</div>
                  <div className="currency-negative" style={{ fontWeight: 800, fontSize: '1rem' }}>{formatCurrency(spent)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Remaining</div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: remaining >= 0 ? 'var(--accent-green)' : 'var(--error)' }}>{formatCurrency(remaining)}</div>
                </div>
              </div>
              <div className="progress-bar" style={{ marginTop: 'var(--space-3)' }}>
                <div className="progress-bar-fill" style={{ width: `${Math.min(100, data.total > 0 ? (spent / data.total) * 100 : 0)}%` }} />
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', marginTop: 4, textAlign: 'right' }}>
                {data.total > 0 ? ((spent / data.total) * 100).toFixed(1) : 0}% used
              </div>
            </div>
          );
        })}
      </div>

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
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{formatDate(t.date, 'medium')}</div>
                </div>
                <div className="currency-positive" style={{ fontWeight: 800 }}>+{formatCurrency(t.amount)}</div>
                <button style={{ color: 'var(--text-tertiary)', padding: 4 }}
                  onClick={() => setEditingTx(t)}>
                  <Edit2 size={14} />
                </button>
                <button style={{ color: 'var(--text-tertiary)', padding: 4 }}
                  onClick={() => { if (confirm('Delete?')) deleteDocument(user.uid, 'transactions', t.id); }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Wallet size={40} />
            <h3>No income entries</h3>
            <Link href="/add" className="btn btn-primary">Add Income</Link>
          </div>
        )}
      </div>

      {editingTx && (
        <EditTransactionModal
          transaction={editingTx}
          userId={user.uid}
          onClose={() => setEditingTx(null)}
        />
      )}
    </div>
  );
}
