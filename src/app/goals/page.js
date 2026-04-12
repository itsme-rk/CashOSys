'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { subscribeGoals, addGoal, updateDocument, deleteDocument } from '@/lib/firestore';
import { formatCurrency, GOAL_PRIORITIES } from '@/lib/constants';
import { Target, Plus, Trash2, X, Check } from 'lucide-react';

export default function GoalsPage() {
  const { user } = useAuth();
  const [goals, setGoals] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', targetAmount: '', savedAmount: '', deadline: '', priority: 'medium' });
  const [addingTo, setAddingTo] = useState(null);
  const [addAmount, setAddAmount] = useState('');

  useEffect(() => { if (user) return subscribeGoals(user.uid, setGoals); }, [user]);

  const handleAdd = async (e) => {
    e.preventDefault();
    await addGoal(user.uid, { ...form, targetAmount: parseFloat(form.targetAmount), savedAmount: parseFloat(form.savedAmount || '0') });
    setForm({ name: '', targetAmount: '', savedAmount: '', deadline: '', priority: 'medium' });
    setShowAdd(false);
  };

  const handleContribute = async (goalId, currentSaved) => {
    const amt = parseFloat(addAmount);
    if (amt > 0) await updateDocument(user.uid, 'goals', goalId, { savedAmount: currentSaved + amt });
    setAddingTo(null); setAddAmount('');
  };

  const pColors = { low: '#448AFF', medium: '#D4AF37', high: '#FF6B6B', critical: '#FF4D4F' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Goals</h1>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={16} /> New Goal</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
        {goals.map(g => {
          const pct = g.targetAmount > 0 ? Math.min(100, (g.savedAmount / g.targetAmount) * 100) : 0;
          return (
            <div key={g.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <div><div style={{ fontWeight: 700, fontSize: '1.0625rem' }}>{g.name}</div>{g.deadline && <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 4 }}>By: {g.deadline}</div>}</div>
                <div style={{ display: 'flex', gap: 4 }}><span className="badge" style={{ background: `${pColors[g.priority]}20`, color: pColors[g.priority] }}>{g.priority}</span><button style={{ color: 'var(--text-tertiary)', padding: 4 }} onClick={() => { if (confirm('Delete?')) deleteDocument(user.uid, 'goals', g.id); }}><Trash2 size={14} /></button></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{pct.toFixed(1)}%</span><span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{formatCurrency((g.targetAmount||0)-(g.savedAmount||0))} left</span></div>
              <div className="progress-bar" style={{ height: 10, marginBottom: 12 }}><div className={`progress-bar-fill ${pct >= 100 ? '' : 'gold'}`} style={{ width: `${pct}%` }} /></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div><div style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Saved</div><div style={{ fontWeight: 800, fontSize: '1.125rem' }}>{formatCurrency(g.savedAmount)}</div></div>
                <div style={{ textAlign: 'right' }}><div style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Target</div><div style={{ fontWeight: 800, fontSize: '1.125rem' }}>{formatCurrency(g.targetAmount)}</div></div>
              </div>
              {addingTo === g.id ? (
                <div style={{ display: 'flex', gap: 8 }}><input type="number" value={addAmount} onChange={e => setAddAmount(e.target.value)} placeholder="Amount" style={{ flex: 1, height: 36 }} autoFocus /><button className="btn btn-primary btn-sm" onClick={() => handleContribute(g.id, g.savedAmount||0)}><Check size={14} /></button><button className="btn btn-ghost btn-sm" onClick={() => setAddingTo(null)}><X size={14} /></button></div>
              ) : (<button className="btn btn-secondary btn-sm" style={{ width: '100%' }} onClick={() => setAddingTo(g.id)}>+ Add Savings</button>)}
            </div>
          );
        })}
        {goals.length === 0 && <div className="card empty-state"><Target size={48} /><h3>No goals</h3><p>Set a target</p><button className="btn btn-primary" onClick={() => setShowAdd(true)}>Create</button></div>}
      </div>
      {showAdd && (<div className="modal-overlay" onClick={() => setShowAdd(false)}><div className="modal-content" onClick={e => e.stopPropagation()}><div className="modal-header"><h2>New Goal</h2><button className="btn-icon btn-ghost" onClick={() => setShowAdd(false)}><X size={18} /></button></div><form onSubmit={handleAdd}><div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}><div className="input-group"><label>Name</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></div><div className="input-group"><label>Target</label><input type="number" value={form.targetAmount} onChange={e => setForm({...form, targetAmount: e.target.value})} required /></div><div className="input-group"><label>Saved</label><input type="number" value={form.savedAmount} onChange={e => setForm({...form, savedAmount: e.target.value})} placeholder="0" /></div><div className="input-group"><label>Deadline</label><input type="date" value={form.deadline} onChange={e => setForm({...form, deadline: e.target.value})} /></div><div className="input-group"><label>Priority</label><select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>{GOAL_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}</select></div></div><div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button><button type="submit" className="btn btn-primary">Create</button></div></form></div></div>)}
    </div>
  );
}
