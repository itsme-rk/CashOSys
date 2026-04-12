'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { subscribeWatchlist, addWatchlistItem, deleteDocument } from '@/lib/firestore';
import { Plus, Trash2, X, Eye, TrendingUp } from 'lucide-react';

export default function WatchlistPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', ticker: '', type: 'stock', notes: '', alertPrice: '' });

  useEffect(() => { if (user) return subscribeWatchlist(user.uid, setItems); }, [user]);

  const handleAdd = async (e) => {
    e.preventDefault();
    await addWatchlistItem(user.uid, form);
    setForm({ name: '', ticker: '', type: 'stock', notes: '', alertPrice: '' });
    setShowAdd(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Watchlist</h1><p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Stocks, ETFs & MFs to monitor</p></div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={16} /> Add</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
        {items.map(item => (
          <div key={item.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>{item.name}</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>{item.ticker} • {item.type}</div>
                {item.notes && <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 8 }}>{item.notes}</div>}
                {item.alertPrice > 0 && <div className="badge badge-gold" style={{ marginTop: 8 }}>Alert at ₹{item.alertPrice}</div>}
              </div>
              <button style={{ color: 'var(--text-tertiary)' }} onClick={() => deleteDocument(user.uid, 'watchlist', item.id)}><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="card empty-state"><Eye size={40} /><h3>No watchlist items</h3><p>Add stocks or ETFs to monitor</p></div>}
      </div>
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>Add to Watchlist</h2><button className="btn-icon btn-ghost" onClick={() => setShowAdd(false)}><X size={18} /></button></div>
            <form onSubmit={handleAdd}><div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="input-group"><label>Name</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required placeholder="Nippon India Nifty 50 BeES" /></div>
              <div className="input-group"><label>Ticker</label><input value={form.ticker} onChange={e => setForm({...form, ticker: e.target.value})} placeholder="NIFTYBEES.NS" /></div>
              <div className="input-group"><label>Type</label><select value={form.type} onChange={e => setForm({...form, type: e.target.value})}><option value="stock">Stock</option><option value="etf">ETF</option><option value="mutual-fund">Mutual Fund</option></select></div>
              <div className="input-group"><label>Alert Price</label><input type="number" value={form.alertPrice} onChange={e => setForm({...form, alertPrice: e.target.value})} placeholder="0" /></div>
              <div className="input-group"><label>Notes</label><textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} /></div>
            </div><div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button><button type="submit" className="btn btn-primary">Add</button></div></form>
          </div>
        </div>
      )}
    </div>
  );
}
