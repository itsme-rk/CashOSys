'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { subscribeInvestments, addInvestment, deleteDocument } from '@/lib/firestore';
import { formatCurrency, formatPercent, DEFAULT_INVESTMENT_BUCKETS } from '@/lib/constants';
import { Plus, Trash2, X, PieChart as PieIcon, Eye } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import Link from 'next/link';

const COLORS = ['#00E676', '#D4AF37', '#FF6B6B', '#448AFF', '#BB8FCE', '#F7DC6F', '#4ECDC4', '#F8C471'];

export default function InvestmentsPage() {
  const { user } = useAuth();
  const [investments, setInvestments] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ bucket: '', instrumentName: '', investedAmount: '', ticker: '', purchaseDate: '', description: '', fundingSource: '' });

  useEffect(() => {
    if (!user) return;
    return subscribeInvestments(user.uid, setInvestments);
  }, [user]);

  const totalInvested = investments.reduce((s, i) => s + (i.investedAmount || 0) - (i.withdrawal || 0), 0);
  const totalCurrent = investments.reduce((s, i) => s + (i.currentValue || i.investedAmount || 0), 0);
  const totalGain = totalCurrent - totalInvested;
  const gainPct = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;

  const buckets = {};
  investments.forEach(i => {
    const b = i.bucket || 'Other';
    if (!buckets[b]) buckets[b] = { invested: 0, current: 0, items: [] };
    buckets[b].invested += (i.investedAmount || 0) - (i.withdrawal || 0);
    buckets[b].current += i.currentValue || i.investedAmount || 0;
    buckets[b].items.push(i);
  });

  const pieData = Object.entries(buckets).map(([name, data]) => ({ name, value: data.current }));

  const handleAdd = async (e) => {
    e.preventDefault();
    await addInvestment(user.uid, { ...form, investedAmount: parseFloat(form.investedAmount), currentValue: parseFloat(form.investedAmount) });
    setForm({ bucket: '', instrumentName: '', investedAmount: '', ticker: '', purchaseDate: '', description: '', fundingSource: '' });
    setShowAdd(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Investments</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: 4 }}>Track your portfolio</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <Link href="/investments/watchlist" className="btn btn-secondary"><Eye size={16} /> Watchlist</Link>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={16} /> Add</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
        <div className="card" style={{ borderColor: totalGain >= 0 ? 'rgba(0,230,118,0.15)' : 'rgba(255,77,79,0.15)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Current Value</div>
          <div className={totalGain >= 0 ? 'currency-positive' : 'currency-negative'} style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: 4 }}>{formatCurrency(totalCurrent)}</div>
        </div>
        <div className="card">
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Invested</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: 4 }}>{formatCurrency(totalInvested)}</div>
        </div>
        <div className="card">
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Gain / Loss</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)', marginTop: 4 }}>
            <span className={totalGain >= 0 ? 'currency-positive' : 'currency-negative'} style={{ fontSize: '1.75rem', fontWeight: 800 }}>{formatCurrency(totalGain, true)}</span>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: totalGain >= 0 ? 'var(--accent-green)' : 'var(--error)' }}>{formatPercent(gainPct)}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 300px) 1fr', gap: 'var(--space-4)' }}>
        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 'var(--space-4)', display: 'flex', gap: 8, alignItems:'center' }}><PieIcon size={16} /> Allocation</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value">
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie><Tooltip formatter={v => formatCurrency(v)} /></PieChart>
            </ResponsiveContainer>
          ) : <div className="empty-state"><p>No data</p></div>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {Object.entries(buckets).map(([name, data], idx) => {
            const gain = data.current - data.invested;
            const pct = data.invested > 0 ? (gain / data.invested) * 100 : 0;
            return (
              <div key={name} className="card card-compact">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 8, height: 32, borderRadius: 4, background: COLORS[idx % COLORS.length] }} />
                    <div><div style={{ fontWeight: 700 }}>{name}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{data.items.length} holdings</div></div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: '1.0625rem' }}>{formatCurrency(data.current)}</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: gain >= 0 ? 'var(--accent-green)' : 'var(--error)' }}>{formatCurrency(gain, true)} ({formatPercent(pct)})</div>
                  </div>
                </div>
                <div style={{ marginTop: 12, borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
                  {data.items.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.8125rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{item.instrumentName || item.description}</span>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <span style={{ fontWeight: 600 }}>{formatCurrency(item.investedAmount)}</span>
                        <button style={{ color: 'var(--text-tertiary)', padding: 2 }} onClick={() => { if (confirm('Delete?')) deleteDocument(user.uid, 'investments', item.id); }}><Trash2 size={12} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>Add Investment</h2><button className="btn-icon btn-ghost" onClick={() => setShowAdd(false)}><X size={18} /></button></div>
            <form onSubmit={handleAdd}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="input-group"><label>Bucket</label><select value={form.bucket} onChange={e => setForm({...form, bucket: e.target.value})} required><option value="">Select...</option>{DEFAULT_INVESTMENT_BUCKETS.map(b => <option key={b.name} value={b.name}>{b.icon} {b.name}</option>)}</select></div>
                <div className="input-group"><label>Instrument Name</label><input value={form.instrumentName} onChange={e => setForm({...form, instrumentName: e.target.value})} placeholder="e.g., Adani Power" required /></div>
                <div className="input-group"><label>Amount</label><input type="number" value={form.investedAmount} onChange={e => setForm({...form, investedAmount: e.target.value})} required /></div>
                <div className="input-group"><label>Ticker (optional)</label><input value={form.ticker} onChange={e => setForm({...form, ticker: e.target.value})} placeholder="ADANIPOWER.NS" /></div>
                <div className="input-group"><label>Date</label><input type="date" value={form.purchaseDate} onChange={e => setForm({...form, purchaseDate: e.target.value})} /></div>
                <div className="input-group"><label>Source</label><select value={form.fundingSource} onChange={e => setForm({...form, fundingSource: e.target.value})}><option value="">Select...</option><option value="Income">Income</option><option value="Income 2.0">Income 2.0</option></select></div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button><button type="submit" className="btn btn-primary">Add</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
