'use client';

import { useState } from 'react';
import { updateDocument } from '@/lib/firestore';
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_SOURCES } from '@/lib/constants';
import { X, Save } from 'lucide-react';

export default function EditTransactionModal({ transaction, userId, onClose }) {
  const [amount, setAmount] = useState(String(transaction.amount || ''));
  const [description, setDescription] = useState(transaction.description || '');
  const [category, setCategory] = useState(transaction.category || '');
  const [date, setDate] = useState(transaction.date || '');
  const [fundingSource, setFundingSource] = useState(transaction.fundingSource || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const isExpense = transaction.type === 'expense';
  const categories = isExpense ? DEFAULT_EXPENSE_CATEGORIES : DEFAULT_INCOME_SOURCES;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDocument(userId, 'transactions', transaction.id, {
        amount: parseFloat(amount),
        description,
        category,
        date,
        fundingSource,
      });
      setSaved(true);
      setTimeout(() => onClose(), 800);
    } catch (err) {
      console.error('Error updating transaction:', err);
    }
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <h2>Edit {isExpense ? 'Expense' : 'Income'}</h2>
          <button className="btn btn-ghost btn-icon-sm" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="input-group">
            <label>Amount (₹)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              step="0.01"
              min="0"
              autoFocus
            />
          </div>
          <div className="input-group">
            <label>Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What was this for?"
            />
          </div>
          <div className="input-group">
            <label>{isExpense ? 'Category' : 'Source'}</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Select...</option>
              {categories.map(c => (
                <option key={c.name} value={c.name}>{c.icon} {c.name}</option>
              ))}
            </select>
          </div>
          <div className="input-group">
            <label>Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          {isExpense && (
            <div className="input-group">
              <label>Funding Source</label>
              <select value={fundingSource} onChange={(e) => setFundingSource(e.target.value)}>
                <option value="">Select...</option>
                {DEFAULT_INCOME_SOURCES.map(s => (
                  <option key={s.name} value={s.name}>{s.icon} {s.name}</option>
                ))}
                <option value="Emergency Funds">🛡️ Emergency Funds</option>
              </select>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || !amount}
          >
            {saved ? '✓ Saved!' : saving ? 'Saving...' : <><Save size={16} /> Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  );
}
