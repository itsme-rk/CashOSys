'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { subscribeLoans, addLoan, updateDocument, deleteDocument } from '@/lib/firestore';
import { formatCurrency } from '@/lib/constants';
import { CreditCard, Plus, Trash2, X } from 'lucide-react';

export default function LoansPage() {
  const { user } = useAuth();
  const [loans, setLoans] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', totalAmount: '', emi: '', interestRate: '', paidTillDate: '', startDate: '' });

  useEffect(() => { if (user) return subscribeLoans(user.uid, setLoans); }, [user]);

  const totalRemaining = loans.reduce((s, l) => s + ((l.totalAmount||0) - (l.paidTillDate||0)), 0);

  const handleAdd = async (e) => {
    e.preventDefault();
    await addLoan(user.uid, { ...form, totalAmount: parseFloat(form.totalAmount), emi: parseFloat(form.emi||'0'), interestRate: parseFloat(form.interestRate||'0'), paidTillDate: parseFloat(form.paidTillDate||'0') });
    setForm({ name: '', totalAmount: '', emi: '', interestRate: '', paidTillDate: '', startDate: '' }); setShowAdd(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}><h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Loans</h1><button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={16} /> Add</button></div>
      <div className="card"><div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 8 }}>Outstanding</div><div className="currency-negative" style={{ fontSize: '1.75rem', fontWeight: 800 }}>{formatCurrency(totalRemaining)}</div></div>
      {loans.map(l => {
        const rem = (l.totalAmount||0)-(l.paidTillDate||0); const pct = l.totalAmount > 0 ? ((l.paidTillDate||0)/l.totalAmount)*100 : 0;
        return (<div key={l.id} className="card"><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}><div><div style={{ fontWeight: 700 }}>{l.name}</div>{l.interestRate > 0 && <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{l.interestRate}% interest</div>}</div><button style={{ color: 'var(--text-tertiary)' }} onClick={() => { if (confirm('Delete?')) deleteDocument(user.uid, 'loans', l.id); }}><Trash2 size={14} /></button></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, textAlign: 'center', marginBottom: 12 }}><div><div style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Total</div><div style={{ fontWeight: 800 }}>{formatCurrency(l.totalAmount)}</div></div><div><div style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Paid</div><div style={{ fontWeight: 800, color: 'var(--accent-green)' }}>{formatCurrency(l.paidTillDate)}</div></div><div><div style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Left</div><div style={{ fontWeight: 800, color: 'var(--error)' }}>{formatCurrency(rem)}</div></div></div>
          <div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${Math.min(100,pct)}%` }} /></div>
          {l.emi > 0 && rem > 0 && <button className="btn btn-secondary btn-sm" style={{ width: '100%', marginTop: 12 }} onClick={() => updateDocument(user.uid, 'loans', l.id, { paidTillDate: (l.paidTillDate||0)+(l.emi||0) })}>Pay EMI ({formatCurrency(l.emi)})</button>}
        </div>);
      })}
      {loans.length === 0 && <div className="card empty-state"><CreditCard size={48} /><h3>No loans</h3><p>Debt-free! 🎉</p></div>}
      {showAdd && (<div className="modal-overlay" onClick={() => setShowAdd(false)}><div className="modal-content" onClick={e => e.stopPropagation()}><div className="modal-header"><h2>Add Loan</h2><button className="btn-icon btn-ghost" onClick={() => setShowAdd(false)}><X size={18} /></button></div><form onSubmit={handleAdd}><div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}><div className="input-group"><label>Name</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></div><div className="input-group"><label>Total</label><input type="number" value={form.totalAmount} onChange={e => setForm({...form, totalAmount: e.target.value})} required /></div><div className="input-group"><label>EMI</label><input type="number" value={form.emi} onChange={e => setForm({...form, emi: e.target.value})} /></div><div className="input-group"><label>Rate %</label><input type="number" step="0.1" value={form.interestRate} onChange={e => setForm({...form, interestRate: e.target.value})} /></div><div className="input-group"><label>Paid</label><input type="number" value={form.paidTillDate} onChange={e => setForm({...form, paidTillDate: e.target.value})} /></div></div><div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button><button type="submit" className="btn btn-primary">Add</button></div></form></div></div>)}
    </div>
  );
}
