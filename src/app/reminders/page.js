'use client';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { addDocument, subscribeToCollection, updateDocument, deleteDocument } from '@/lib/firestore';
import { formatCurrency } from '@/lib/constants';
import { Bell, Calendar, Plus, Trash2, X, Check, AlertCircle, Edit3 } from 'lucide-react';
import styles from './reminders.module.css';

const CATEGORIES = [
  { name: 'Recharge', icon: '📱' },
  { name: 'Spotify', icon: '🎵' },
  { name: 'Netflix', icon: '🎬' },
  { name: 'Rent', icon: '🏠' },
  { name: 'Insurance', icon: '🛡️' },
  { name: 'SIP', icon: '📈' },
  { name: 'EMI', icon: '🏦' },
  { name: 'Electricity', icon: '⚡' },
  { name: 'Internet', icon: '🌐' },
  { name: 'Other', icon: '📌' },
];

function getCategoryIcon(categoryName) {
  const cat = CATEGORIES.find(c => c.name === categoryName);
  return cat?.icon || '📌';
}

export default function RemindersPage() {
  const { user } = useAuth();
  const [reminders, setReminders] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    name: '', amount: '', dueDay: '', category: 'Recharge', isActive: true, notes: '',
  });

  useEffect(() => {
    if (user) return subscribeToCollection(user.uid, 'reminders', setReminders);
  }, [user]);

  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Sort: overdue first, then due today, then upcoming (closest first), then inactive
  const sortedReminders = useMemo(() => {
    return [...reminders].sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      const aStatus = getStatus(a.dueDay);
      const bStatus = getStatus(b.dueDay);
      const order = { overdue: 0, due: 1, upcoming: 2 };
      if (order[aStatus] !== order[bStatus]) return order[aStatus] - order[bStatus];
      // For upcoming, sort by closest due day
      const aDays = daysUntilDue(a.dueDay);
      const bDays = daysUntilDue(b.dueDay);
      return aDays - bDays;
    });
  }, [reminders, currentDay]); // eslint-disable-line react-hooks/exhaustive-deps

  function getStatus(dueDay) {
    if (dueDay < currentDay) return 'overdue';
    if (dueDay === currentDay) return 'due';
    return 'upcoming';
  }

  function daysUntilDue(dueDay) {
    if (dueDay >= currentDay) return dueDay - currentDay;
    return daysInMonth - currentDay + dueDay;
  }

  function getStatusLabel(dueDay, isActive) {
    if (!isActive) return { text: 'Inactive', className: styles.statusInactive };
    const status = getStatus(dueDay);
    if (status === 'overdue') return { text: 'Overdue', className: styles.statusOverdue };
    if (status === 'due') return { text: 'Due Today', className: styles.statusDue };
    const days = daysUntilDue(dueDay);
    return { text: `In ${days}d`, className: styles.statusUpcoming };
  }

  const activeReminders = reminders.filter(r => r.isActive);
  const totalMonthly = activeReminders.reduce((sum, r) => sum + (r.amount || 0), 0);
  const overdueCount = activeReminders.filter(r => getStatus(r.dueDay) === 'overdue').length;
  const dueTodayCount = activeReminders.filter(r => getStatus(r.dueDay) === 'due').length;

  const resetForm = () => {
    setForm({ name: '', amount: '', dueDay: '', category: 'Recharge', isActive: true, notes: '' });
    setEditingId(null);
  };

  const openAdd = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (reminder) => {
    setForm({
      name: reminder.name || '',
      amount: String(reminder.amount || ''),
      dueDay: String(reminder.dueDay || ''),
      category: reminder.category || 'Other',
      isActive: reminder.isActive !== false,
      notes: reminder.notes || '',
    });
    setEditingId(reminder.id);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = {
      name: form.name.trim(),
      amount: parseFloat(form.amount),
      dueDay: parseInt(form.dueDay, 10),
      category: form.category,
      isActive: form.isActive,
      notes: form.notes.trim(),
    };

    if (editingId) {
      await updateDocument(user.uid, 'reminders', editingId, data);
    } else {
      await addDocument(user.uid, 'reminders', data);
    }
    closeModal();
  };

  const handleDelete = async (id) => {
    if (confirm('Delete this reminder?')) {
      await deleteDocument(user.uid, 'reminders', id);
    }
  };

  const handleToggle = async (reminder) => {
    await updateDocument(user.uid, 'reminders', reminder.id, {
      isActive: !reminder.isActive,
    });
  };

  const ordinalDay = (day) => {
    if (!day) return '';
    const s = ['th', 'st', 'nd', 'rd'];
    const v = day % 100;
    return day + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <Bell size={28} className={styles.titleIcon} /> Bill Reminders
          </h1>
          <p className={styles.subtitle}>
            Track your recurring bills and never miss a due date
          </p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus size={16} /> Add Reminder
        </button>
      </div>

      {/* Summary cards */}
      <div className={styles.summaryRow}>
        <div className={`card ${styles.summaryCard}`}>
          <div className={styles.summaryLabel}>Monthly Total</div>
          <div className={`${styles.summaryValue} currency-negative`}>
            {formatCurrency(totalMonthly)}
          </div>
        </div>
        <div className={`card ${styles.summaryCard}`}>
          <div className={styles.summaryLabel}>Active Bills</div>
          <div className={styles.summaryValue}>
            {activeReminders.length}
          </div>
        </div>
        <div className={`card ${styles.summaryCard}`}>
          <div className={styles.summaryLabel}>Overdue</div>
          <div className={styles.summaryValue} style={{ color: overdueCount > 0 ? 'var(--error)' : 'var(--accent-green)' }}>
            {overdueCount}
          </div>
        </div>
        <div className={`card ${styles.summaryCard}`}>
          <div className={styles.summaryLabel}>Due Today</div>
          <div className={styles.summaryValue} style={{ color: dueTodayCount > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>
            {dueTodayCount}
          </div>
        </div>
      </div>

      {/* Reminders list */}
      {sortedReminders.length > 0 ? (
        <div className={styles.reminderList}>
          {sortedReminders.map((r, i) => {
            const statusInfo = getStatusLabel(r.dueDay, r.isActive);
            return (
              <div
                key={r.id}
                className={styles.reminderItem}
                style={{ animationDelay: `${i * 40}ms`, opacity: r.isActive ? 1 : 0.5 }}
              >
                <div className={styles.reminderIcon}>
                  <span className={styles.categoryIcon}>{getCategoryIcon(r.category)}</span>
                </div>
                <div className={styles.reminderInfo}>
                  <div className={styles.reminderName}>{r.name}</div>
                  <div className={styles.reminderMeta}>
                    <Calendar size={12} />
                    <span>Due: {ordinalDay(r.dueDay)} of every month</span>
                    <span>•</span>
                    <span>{r.category}</span>
                  </div>
                  {r.notes && (
                    <div className={styles.reminderNotes}>{r.notes}</div>
                  )}
                </div>
                <div className={styles.reminderRight}>
                  <span className={`${styles.statusBadge} ${statusInfo.className}`}>
                    {statusInfo.text}
                  </span>
                  <div className={styles.reminderAmount}>
                    {formatCurrency(r.amount)}
                  </div>
                  <div
                    className={`${styles.toggleSwitch} ${r.isActive ? styles.active : ''}`}
                    onClick={() => handleToggle(r)}
                    title={r.isActive ? 'Active — click to pause' : 'Paused — click to activate'}
                  >
                    <div className={styles.toggleKnob} />
                  </div>
                  <div className={styles.itemActions}>
                    <button className={styles.actionBtn} onClick={() => openEdit(r)} title="Edit">
                      <Edit3 size={14} />
                    </button>
                    <button className={styles.actionBtn} onClick={() => handleDelete(r.id)} title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card empty-state">
          <Bell size={48} />
          <h3>No bill reminders yet</h3>
          <p>Add your recurring bills to stay on top of payments</p>
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={16} /> Add Reminder
          </button>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingId ? 'Edit Reminder' : 'New Reminder'}</h2>
              <button className="btn-icon btn-ghost" onClick={closeModal}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="input-group">
                  <label>Bill Name</label>
                  <input
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Netflix Subscription"
                    required
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="input-group">
                    <label>Amount (₹)</label>
                    <input
                      type="number"
                      value={form.amount}
                      onChange={e => setForm({ ...form, amount: e.target.value })}
                      placeholder="499"
                      min="0"
                      step="any"
                      required
                    />
                  </div>
                  <div className="input-group">
                    <label>Due Day (1–31)</label>
                    <input
                      type="number"
                      value={form.dueDay}
                      onChange={e => setForm({ ...form, dueDay: e.target.value })}
                      placeholder="15"
                      min="1"
                      max="31"
                      required
                    />
                  </div>
                </div>
                <div className="input-group">
                  <label>Category</label>
                  <select
                    value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                  >
                    {CATEGORIES.map(c => (
                      <option key={c.name} value={c.name}>{c.icon} {c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label>Notes (optional)</label>
                  <input
                    value={form.notes}
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                    placeholder="Any extra details..."
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    className={`${styles.toggleSwitch} ${form.isActive ? styles.active : ''}`}
                    onClick={() => setForm({ ...form, isActive: !form.isActive })}
                  >
                    <div className={styles.toggleKnob} />
                  </div>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    {form.isActive ? 'Active' : 'Paused'}
                  </span>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  <Check size={16} /> {editingId ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
