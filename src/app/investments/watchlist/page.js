'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { subscribeWatchlist, addWatchlistItem, updateDocument, deleteDocument } from '@/lib/firestore';
import { Plus, Trash2, X, Eye, TrendingUp, TrendingDown, Star, Target, AlertTriangle } from 'lucide-react';

const PRIORITY_COLORS = { high: '#FF6B6B', medium: '#D4AF37', low: '#448AFF' };
const PRIORITY_LABELS = ['high', 'medium', 'low'];

export default function WatchlistPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: '', ticker: '', type: 'stock', notes: '', alertPrice: '',
    targetBuyPrice: '', whyBuy: '', priority: 'medium', sector: '',
  });

  useEffect(() => { if (user) return subscribeWatchlist(user.uid, setItems); }, [user]);

  const handleAdd = async (e) => {
    e.preventDefault();
    await addWatchlistItem(user.uid, {
      ...form,
      alertPrice: parseFloat(form.alertPrice) || 0,
      targetBuyPrice: parseFloat(form.targetBuyPrice) || 0,
    });
    setForm({ name: '', ticker: '', type: 'stock', notes: '', alertPrice: '', targetBuyPrice: '', whyBuy: '', priority: 'medium', sector: '' });
    setShowAdd(false);
  };

  const highPriority = items.filter(i => (i.priority || 'medium') === 'high');
  const medPriority = items.filter(i => (i.priority || 'medium') === 'medium');
  const lowPriority = items.filter(i => (i.priority || 'medium') === 'low');

  const renderCard = (item) => (
    <div key={item.id} className="card" style={{ position: 'relative', overflow: 'visible' }}>
      <div style={{ position: 'absolute', top: -6, right: 12 }}>
        <span className="badge" style={{
          background: `${PRIORITY_COLORS[item.priority || 'medium']}20`,
          color: PRIORITY_COLORS[item.priority || 'medium'],
          fontWeight: 700, fontSize: '0.6875rem', textTransform: 'uppercase',
        }}>
          {item.priority || 'medium'}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: '1.0625rem' }}>{item.name}</div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
            {item.ticker && <span style={{ fontFamily: 'monospace', background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: 4, fontSize: '0.75rem' }}>{item.ticker}</span>}
            {' '}<span style={{ textTransform: 'uppercase', fontSize: '0.6875rem', letterSpacing: '0.05em' }}>{item.type}</span>
            {item.sector && <span> • {item.sector}</span>}
          </div>
        </div>
        <button style={{ color: 'var(--text-tertiary)', padding: 4 }} onClick={() => {
          if (confirm('Remove from watchlist?')) deleteDocument(user.uid, 'watchlist', item.id);
        }}><Trash2 size={16} /></button>
      </div>
      
      {/* Price Targets */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        {item.targetBuyPrice > 0 && (
          <div style={{ padding: '8px 12px', background: 'var(--success-bg)', borderRadius: 'var(--radius-md)', flex: 1 }}>
            <div style={{ fontSize: '0.625rem', fontWeight: 700, color: 'var(--accent-green)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Target Buy</div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--accent-green)' }}>₹{item.targetBuyPrice}</div>
          </div>
        )}
        {item.alertPrice > 0 && (
          <div style={{ padding: '8px 12px', background: 'var(--warning-bg)', borderRadius: 'var(--radius-md)', flex: 1 }}>
            <div style={{ fontSize: '0.625rem', fontWeight: 700, color: 'var(--accent-gold)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Alert At</div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--accent-gold)' }}>₹{item.alertPrice}</div>
          </div>
        )}
      </div>

      {/* Why Buy */}
      {item.whyBuy && (
        <div style={{ marginBottom: 8, padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', borderLeft: `3px solid ${PRIORITY_COLORS[item.priority || 'medium']}` }}>
          <div style={{ fontSize: '0.625rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>Investment Thesis</div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.whyBuy}</div>
        </div>
      )}

      {/* Notes */}
      {item.notes && <div style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>📝 {item.notes}</div>}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Eye size={28} style={{ color: 'var(--accent-gold)' }} /> Watchlist
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: 4 }}>
            {items.length} stocks/ETFs/MFs to monitor • Future investments
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={16} /> Add to Watchlist</button>
      </div>

      {/* Priority Sections */}
      {highPriority.length > 0 && (
        <div>
          <h3 style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#FF6B6B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, display: 'flex', gap: 6, alignItems: 'center' }}><AlertTriangle size={14} /> High Priority — Buy Soon</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
            {highPriority.map(renderCard)}
          </div>
        </div>
      )}

      {medPriority.length > 0 && (
        <div>
          <h3 style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, display: 'flex', gap: 6, alignItems: 'center' }}><Star size={14} /> Medium Priority — On Radar</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
            {medPriority.map(renderCard)}
          </div>
        </div>
      )}

      {lowPriority.length > 0 && (
        <div>
          <h3 style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#448AFF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, display: 'flex', gap: 6, alignItems: 'center' }}><Target size={14} /> Low Priority — Future Watch</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
            {lowPriority.map(renderCard)}
          </div>
        </div>
      )}

      {items.length === 0 && (
        <div className="card empty-state">
          <Eye size={48} style={{ color: 'var(--accent-gold)' }} />
          <h3>Your watchlist is empty</h3>
          <p>Add stocks, ETFs, or mutual funds you're interested in investing in the future</p>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>Add First Item</button>
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h2>Add to Watchlist</h2>
              <button className="btn-icon btn-ghost" onClick={() => setShowAdd(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleAdd}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="input-group">
                  <label>Name *</label>
                  <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required placeholder="e.g., Nippon India Nifty 50 BeES" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="input-group">
                    <label>Ticker</label>
                    <input value={form.ticker} onChange={e => setForm({...form, ticker: e.target.value})} placeholder="NIFTYBEES.NS" />
                  </div>
                  <div className="input-group">
                    <label>Type</label>
                    <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                      <option value="stock">Stock</option>
                      <option value="etf">ETF</option>
                      <option value="mutual-fund">Mutual Fund</option>
                      <option value="gold">Gold</option>
                      <option value="bond">Bond/FD</option>
                    </select>
                  </div>
                </div>
                <div className="input-group">
                  <label>Sector</label>
                  <input value={form.sector} onChange={e => setForm({...form, sector: e.target.value})} placeholder="e.g., Energy, IT, Banking" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="input-group">
                    <label>Target Buy Price (₹)</label>
                    <input type="number" value={form.targetBuyPrice} onChange={e => setForm({...form, targetBuyPrice: e.target.value})} placeholder="0" />
                  </div>
                  <div className="input-group">
                    <label>Alert Price (₹)</label>
                    <input type="number" value={form.alertPrice} onChange={e => setForm({...form, alertPrice: e.target.value})} placeholder="0" />
                  </div>
                </div>
                <div className="input-group">
                  <label>Priority</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {PRIORITY_LABELS.map(p => (
                      <button key={p} type="button" onClick={() => setForm({...form, priority: p})} style={{
                        flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-md)',
                        border: form.priority === p ? `2px solid ${PRIORITY_COLORS[p]}` : '1px solid var(--border-color)',
                        background: form.priority === p ? `${PRIORITY_COLORS[p]}15` : 'var(--bg-secondary)',
                        color: form.priority === p ? PRIORITY_COLORS[p] : 'var(--text-secondary)',
                        fontWeight: 600, fontSize: '0.8125rem', textTransform: 'capitalize', cursor: 'pointer',
                      }}>{p}</button>
                    ))}
                  </div>
                </div>
                <div className="input-group">
                  <label>Why do you want to buy this? (Investment Thesis)</label>
                  <textarea value={form.whyBuy} onChange={e => setForm({...form, whyBuy: e.target.value})} rows={2} placeholder="e.g., Good fundamentals, sector growth potential..." />
                </div>
                <div className="input-group">
                  <label>Notes</label>
                  <input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Any additional notes..." />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add to Watchlist</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
