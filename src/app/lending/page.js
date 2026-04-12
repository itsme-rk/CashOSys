'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { subscribeLending, addLending, updateDocument, deleteDocument } from '@/lib/firestore';
import { formatCurrency, formatDate, LENDING_STATUSES } from '@/lib/constants';
import { Users, Plus, Trash2, X, Check } from 'lucide-react';

export default function LendingPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ personName: '', amount: '', date: new Date().toISOString().split('T')[0], status: 'waiting', notes: '' });

  useEffect(() => { if (user) return subscribeLending(user.uid, setItems); }, [user]);

  const outstanding = items.filter(i => i.status === 'waiting' || i.status === 'partial').reduce((s, i) => s + (i.amount || 0), 0);

  const handleAdd = async (e) => {
    e.preventDefault();
    await addLending(user.uid, { ...form, amount: parseFloat(form.amount) });
    setForm({ personName: '', amount: '', date: new Date().toISOString().split('T')[0], status: 'waiting', notes: '' }); setShowAdd(false);
  };

  const statusColors = { waiting: '#D4AF37', partial: '#448AFF', returned: '#00E676', 'written-off': '#FF4D4F' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}><div><h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Personal Lending</h1><p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Money lent to friends</p></div><button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={16} /> Add</button></div>

      <div className="card card-glow-gold"><div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 8 }}>Outstanding</div><div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-gold)' }}>{formatCurrency(outstanding)}</div><div style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>{items.filter(i => i.status === 'waiting').length} pending returns</div></div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {items.map(item => (
          <div key={item.id} className="card card-compact" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-full)', background: 'var(--warning-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.875rem', color: 'var(--accent-gold)' }}>{item.personName?.[0]?.toUpperCase()}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{item.personName}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{formatDate(item.date, 'medium')}{item.notes ? ` • ${item.notes}` : ''}</div>
            </div>
            <div style={{ fontWeight: 800 }}>{formatCurrency(item.amount)}</div>
            <select value={item.status} onChange={e => updateDocument(user.uid, 'personalLending', item.id, { status: e.target.value })} style={{ width: 100, height: 32, fontSize: '0.75rem', borderColor: statusColors[item.status], color: statusColors[item.status] }}>
              {LENDING_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button style={{ color: 'var(--text-tertiary)' }} onClick={() => { if (confirm('Delete?')) deleteDocument(user.uid, 'personalLending', item.id); }}><Trash2 size={14} /></button>
          </div>
        ))}
        {items.length === 0 && <div className="card empty-state"><Users size={48} /><h3>No lending</h3><p>Track money lent to friends</p></div>}
      </div>

      {showAdd && (<div className="modal-overlay" onClick={() => setShowAdd(false)}><div className="modal-content" onClick={e => e.stopPropagation()}><div className="modal-header"><h2>Add Lending</h2><button className="btn-icon btn-ghost" onClick={() => setShowAdd(false)}><X size={18} /></button></div><form onSubmit={handleAdd}><div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}><div className="input-group"><label>Person</label><input value={form.personName} onChange={e => setForm({...form, personName: e.target.value})} required /></div><div className="input-group"><label>Amount</label><input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} required /></div><div className="input-group"><label>Date</label><input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} /></div><div className="input-group"><label>Notes</label><input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div></div><div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button><button type="submit" className="btn btn-primary">Add</button></div></form></div></div>)}
    </div>
  );
}
