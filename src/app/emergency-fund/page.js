'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { subscribeEmergencyFund, addEmergencyFundEntry, deleteDocument, subscribeTransactions } from '@/lib/firestore';
import { formatCurrency, formatDate } from '@/lib/constants';
import { Shield, Plus, Trash2, X, ArrowUp, ArrowDown } from 'lucide-react';

export default function EmergencyFundPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ description: '', amount: '', date: new Date().toISOString().split('T')[0], type: 'deposit' });

  useEffect(() => {
    if (!user) return;
    const u1 = subscribeEmergencyFund(user.uid, setEntries);
    const u2 = subscribeTransactions(user.uid, setTransactions);
    return () => { u1(); u2(); };
  }, [user]);

  const balance = entries.reduce((s, e) => s + (e.amount || 0), 0);
  const avgMonthlyExp = (() => {
    const exps = transactions.filter(t => t.type === 'expense');
    if (exps.length === 0) return 0;
    const months = new Set(exps.map(t => { const d = new Date(t.date); return `${d.getFullYear()}-${d.getMonth()}`; })).size;
    return exps.reduce((s, t) => s + (t.amount || 0), 0) / Math.max(1, months);
  })();
  const survivalMonths = avgMonthlyExp > 0 ? balance / avgMonthlyExp : 0;

  const handleAdd = async (e) => {
    e.preventDefault();
    const amt = parseFloat(form.amount);
    await addEmergencyFundEntry(user.uid, { ...form, amount: form.type === 'withdrawal' ? -Math.abs(amt) : Math.abs(amt) });
    setForm({ description: '', amount: '', date: new Date().toISOString().split('T')[0], type: 'deposit' });
    setShowAdd(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Emergency Fund</h1>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={16} /> Add Entry</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
        <div className="card card-glow-green">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}><Shield size={20} style={{ color: 'var(--accent-green)' }} /><span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Balance</span></div>
          <div className="currency-positive" style={{ fontSize: '2rem', fontWeight: 800 }}>{formatCurrency(balance)}</div>
        </div>
        <div className="card">
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 12 }}>Survival</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-gold)' }}>{survivalMonths.toFixed(1)} <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-tertiary)' }}>months</span></div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>Ledger</h3>
        {entries.length > 0 ? entries.map((e, i) => {
          const runBal = entries.slice(0, i + 1).reduce((s, x) => s + (x.amount || 0), 0);
          return (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: e.amount >= 0 ? 'var(--success-bg)' : 'var(--error-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {e.amount >= 0 ? <ArrowUp size={14} style={{ color: 'var(--accent-green)' }} /> : <ArrowDown size={14} style={{ color: 'var(--error)' }} />}
              </div>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{e.description}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{formatDate(e.date, 'medium')}</div></div>
              <div style={{ textAlign: 'right' }}><div className={e.amount >= 0 ? 'currency-positive' : 'currency-negative'} style={{ fontWeight: 700 }}>{formatCurrency(e.amount, true)}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Bal: {formatCurrency(runBal)}</div></div>
              <button style={{ color: 'var(--text-tertiary)', padding: 4 }} onClick={() => { if (confirm('Delete?')) deleteDocument(user.uid, 'emergencyFund', e.id); }}><Trash2 size={14} /></button>
            </div>
          );
        }) : <div className="empty-state"><Shield size={40} /><h3>Empty</h3><p>Start building your safety net</p></div>}
      </div>

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}><div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header"><h2>Add Entry</h2><button className="btn-icon btn-ghost" onClick={() => setShowAdd(false)}><X size={18} /></button></div>
          <form onSubmit={handleAdd}><div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className={`btn ${form.type === 'deposit' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1 }} onClick={() => setForm({...form, type: 'deposit'})}>Deposit</button>
              <button type="button" className={`btn ${form.type === 'withdrawal' ? 'btn-danger' : 'btn-secondary'}`} style={{ flex: 1 }} onClick={() => setForm({...form, type: 'withdrawal'})}>Withdraw</button>
            </div>
            <div className="input-group"><label>Description</label><input value={form.description} onChange={e => setForm({...form, description: e.target.value})} required /></div>
            <div className="input-group"><label>Amount</label><input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} required /></div>
            <div className="input-group"><label>Date</label><input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} /></div>
          </div><div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button><button type="submit" className="btn btn-primary">Add</button></div></form>
        </div></div>
      )}
    </div>
  );
}
