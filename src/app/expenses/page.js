'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { subscribeTransactions, deleteDocument } from '@/lib/firestore';
import { getCycleForDate, getAvailableMonths } from '@/lib/salaryCycle';
import { formatCurrency, formatDate, DEFAULT_EXPENSE_CATEGORIES } from '@/lib/constants';
import EditTransactionModal from '@/components/EditTransactionModal';
import {
  Search, Filter, Trash2, Edit2, ChevronDown, X, Calendar,
  TrendingDown, ArrowUpDown,
} from 'lucide-react';
import Link from 'next/link';
import styles from './expenses.module.css';

export default function ExpensesPage() {
  const { user, userProfile } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterCycleId, setFilterCycleId] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [editingTx, setEditingTx] = useState(null);

  const salaryCycleDay = userProfile?.salaryCycleDay || 28;
  const incomeDates = useMemo(() => {
    return transactions
      .filter(t => t.type === 'income' && t.category === 'Income' && t.date)
      .map(t => new Date(t.date).toISOString())
      .sort();
  }, [transactions]);
  const availableMonths = useMemo(() => getAvailableMonths(salaryCycleDay, incomeDates).reverse(), [salaryCycleDay, incomeDates]);
  const [filterMonth, setFilterMonth] = useState('');
  const filterPanelRef = useRef(null);

  // Calendar months from data
  const calendarMonths = useMemo(() => {
    const months = new Set();
    transactions.forEach(t => {
      if (!t.date || t.type !== 'expense') return;
      const d = new Date(t.date);
      months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    });
    return [...months].sort().reverse().map(key => {
      const [y, m] = key.split('-');
      const d = new Date(parseInt(y), parseInt(m) - 1, 1);
      return { id: key, label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) };
    });
  }, [transactions]);

  useEffect(() => {
    if (!user) return;
    return subscribeTransactions(user.uid, setTransactions);
  }, [user]);

  const expenses = useMemo(() => {
    let filtered = transactions.filter(t => t.type === 'expense');

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(t =>
        t.description?.toLowerCase().includes(term) ||
        t.category?.toLowerCase().includes(term)
      );
    }
    if (filterCategory) filtered = filtered.filter(t => t.category === filterCategory);
    if (filterSource) filtered = filtered.filter(t => t.fundingSource === filterSource);
    if (filterCycleId) {
      filtered = filtered.filter(t => {
        const cycle = getCycleForDate(t.date, salaryCycleDay, incomeDates);
        return cycle.id === filterCycleId;
      });
    }
    if (filterMonth) {
      filtered = filtered.filter(t => {
        const d = new Date(t.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return key === filterMonth;
      });
    }

    filtered.sort((a, b) => {
      if (sortBy === 'date') {
        return sortDir === 'desc'
          ? new Date(b.date) - new Date(a.date)
          : new Date(a.date) - new Date(b.date);
      }
      if (sortBy === 'amount') {
        return sortDir === 'desc' ? b.amount - a.amount : a.amount - b.amount;
      }
      return 0;
    });

    return filtered;
  }, [transactions, searchTerm, filterCategory, filterSource, filterCycleId, filterMonth, sortBy, sortDir, salaryCycleDay, incomeDates]);

  const totalExpenses = expenses.reduce((sum, t) => sum + (t.amount || 0), 0);
  const categories = [...new Set(transactions.filter(t => t.type === 'expense').map(t => t.category).filter(Boolean))];
  const sources = [...new Set(transactions.filter(t => t.type === 'expense').map(t => t.fundingSource).filter(Boolean))];

  const handleDelete = async (id) => {
    if (confirm('Delete this expense?')) {
      await deleteDocument(user.uid, 'transactions', id);
    }
  };



  const getCatEmoji = (cat) => {
    const found = DEFAULT_EXPENSE_CATEGORIES.find(c => c.name.toLowerCase() === cat?.toLowerCase());
    return found?.icon || '📌';
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>Expenses</h1>
          <p className={styles.subtitle}>
            {expenses.length} transactions • Total: <span className="currency-negative">{formatCurrency(totalExpenses)}</span>
          </p>
        </div>
        <Link href="/add" className="btn btn-primary">
          <TrendingDown size={16} /> Add Expense
        </Link>
      </div>

      {/* Search & Filters */}
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Search size={18} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search expenses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className={styles.clearBtn}>
              <X size={16} />
            </button>
          )}
        </div>
        <button
          className={`btn btn-secondary ${styles.filterBtn}`}
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter size={16} />
          Filters
          {(filterCategory || filterSource || filterCycleId) && <span className={styles.filterDot} />}
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
        >
          <ArrowUpDown size={16} />
          {sortBy === 'date' ? 'Date' : 'Amount'}
        </button>
      </div>

      {showFilters && (
        <div className={`card card-compact ${styles.filterPanel}`}>
          <div className={styles.filterRow}>
            <div className={styles.filterGroup}>
              <label>Category</label>
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                <option value="">All Categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className={styles.filterGroup}>
              <label>Funding Source</label>
              <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)}>
                <option value="">All Sources</option>
                {sources.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className={styles.filterGroup}>
              <label>Salary Cycle</label>
              <select value={filterCycleId} onChange={(e) => { setFilterCycleId(e.target.value); setFilterMonth(''); }}>
                <option value="">All Cycles</option>
                {availableMonths.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div className={styles.filterGroup}>
              <label>Calendar Month</label>
              <select value={filterMonth} onChange={(e) => { setFilterMonth(e.target.value); setFilterCycleId(''); }}>
                <option value="">All Months</option>
                {calendarMonths.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
          </div>
          {(filterCategory || filterSource || filterCycleId || filterMonth) && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => { setFilterCategory(''); setFilterSource(''); setFilterCycleId(''); setFilterMonth(''); }}
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Expense List */}
      <div className={styles.list}>
        {expenses.length > 0 ? expenses.map((t, i) => (
          <div
            key={t.id}
            className={styles.expenseItem}
            style={{ animationDelay: `${Math.min(i, 15) * 30}ms` }}
          >
            <div className={styles.expIcon}>
              {getCatEmoji(t.category)}
            </div>
            <div className={styles.expDetails}>
              <div className={styles.expTop}>
                <span className={styles.expCategory}>{t.category}</span>
                {t.isInvestment && <span className="badge badge-gold">Investment</span>}
              </div>
              <span className={styles.expDesc}>{t.description || '—'}</span>
              <div className={styles.expMeta}>
                <span><Calendar size={12} /> {formatDate(t.date, 'medium')}</span>
                <span>•</span>
                <span>{t.fundingSource}</span>
                <span>•</span>
                <span>{t.salaryCycleLabel}</span>
              </div>
            </div>
            <div className={styles.expRight}>
              <span className={`${styles.expAmount} currency-negative`}>
                -{formatCurrency(t.amount)}
              </span>
              <div className={styles.expActions}>
                <button
                  className={styles.actionBtn}
                  onClick={() => setEditingTx(t)}
                  title="Edit"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  className={`${styles.actionBtn} ${styles.deleteBtn}`}
                  onClick={() => handleDelete(t.id)}
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        )) : (
          <div className="card empty-state">
            <TrendingDown size={48} />
            <h3>No expenses found</h3>
            <p>{searchTerm || filterCategory ? 'Try adjusting your filters' : 'Add your first expense to get started'}</p>
            <Link href="/add" className="btn btn-primary">Add Expense</Link>
          </div>
        )}
      </div>

      {/* Edit Modal */}
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
