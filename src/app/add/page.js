'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import {
  addTransaction,
  addInvestment,
  subscribeIncomeSources,
  subscribeCategories,
} from '@/lib/firestore';
import { getCycleForDate } from '@/lib/salaryCycle';
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_SOURCES,
  DEFAULT_REFUND_SOURCES,
  DEFAULT_INVESTMENT_BUCKETS,
} from '@/lib/constants';
import {
  ArrowLeft, Check, TrendingUp, TrendingDown, ToggleLeft, ToggleRight,
  Plus, X,
} from 'lucide-react';
import Link from 'next/link';
import styles from './add.module.css';

export default function AddTransactionPage() {
  const { user, userProfile } = useAuth();
  const router = useRouter();
  const [type, setType] = useState('expense');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [fundingSource, setFundingSource] = useState('');
  const [isInvestment, setIsInvestment] = useState(false);
  const [investmentBucket, setInvestmentBucket] = useState('');
  const [investmentTicker, setInvestmentTicker] = useState('');
  const [subType, setSubType] = useState('');
  const [litres, setLitres] = useState('');
  const [odometerReading, setOdometerReading] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [customCategories, setCustomCategories] = useState([]);
  const [customSources, setCustomSources] = useState([]);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const salaryCycleDay = userProfile?.salaryCycleDay || 28;

  useEffect(() => {
    if (!user) return;
    const unsub1 = subscribeCategories(user.uid, setCustomCategories);
    const unsub2 = subscribeIncomeSources(user.uid, setCustomSources);
    return () => { unsub1(); unsub2(); };
  }, [user]);

  const allExpenseCategories = [
    ...DEFAULT_EXPENSE_CATEGORIES,
    ...customCategories.filter(c => c.type === 'expense'),
  ];

  const allIncomeSources = [
    ...DEFAULT_INCOME_SOURCES,
    ...customSources,
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || !category) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const cycle = getCycleForDate(date, salaryCycleDay);

      const computedSubType = subType || (type === 'income' ? 'salary' : (type === 'refund' ? 'refund_repay' : ''));
      const txData = {
        type: type === 'refund' ? 'income' : type, // Structural type is income so it increases balance
        subType: computedSubType, // Keeps 'refund_repay' label so Dashboard can exclude it from Salary
        category,
        description,
        amount: parseFloat(amount),
        date,
        fundingSource: type === 'expense' ? fundingSource : category,
        salaryCycleId: cycle.id,
        salaryCycleLabel: cycle.label,
        isInvestment,
        // Fuel fields
        litres: category === 'Fuel' && litres ? parseFloat(litres) : null,
        odometerReading: category === 'Fuel' && odometerReading ? parseFloat(odometerReading) : null,
      };

      // Add transaction
      const tx = await addTransaction(user.uid, txData);

      // Also add investment if toggled
      if (isInvestment && type === 'expense') {
        await addInvestment(user.uid, {
          bucket: investmentBucket || category,
          instrumentName: description,
          fundingSource,
          investedAmount: parseFloat(amount),
          currentValue: parseFloat(amount),
          ticker: investmentTicker,
          purchaseDate: date,
          description,
        });
      }

      setSuccess(true);
      setTimeout(() => {
        // Reset form
        setCategory('');
        setDescription('');
        setAmount('');
        setFundingSource('');
        setIsInvestment(false);
        setInvestmentBucket('');
        setInvestmentTicker('');
        setSubType('');
        setLitres('');
        setOdometerReading('');
        setSuccess(false);
      }, 1500);
    } catch (err) {
      setError(err.message || 'Failed to add transaction');
    }
    setLoading(false);
  };

  return (
    <div className={styles.addPage}>
      <div className={styles.header}>
        <Link href="/dashboard" className={styles.backBtn}>
          <ArrowLeft size={20} />
        </Link>
        <h1>Add Transaction</h1>
      </div>

      {/* Type Toggle */}
      <div className={styles.typeToggle}>
        <button
          type="button"
          className={`${styles.typeBtn} ${type === 'expense' ? styles.typeExpense : ''}`}
          onClick={() => { setType('expense'); setCategory(''); }}
        >
          <TrendingDown size={18} />
          Expense
        </button>
        <button
          type="button"
          className={`${styles.typeBtn} ${type === 'income' ? styles.typeIncome : ''}`}
          onClick={() => { setType('income'); setCategory(''); }}
        >
          <TrendingUp size={18} />
          Income
        </button>
        <button
          type="button"
          className={`${styles.typeBtn} ${type === 'refund' ? styles.typeRefund : ''}`}
          onClick={() => { setType('refund'); setCategory(''); }}
          style={{ '--btn-color': '#45B7D1', color: type === 'refund' ? '#fff' : 'var(--text-secondary)' }}
        >
          <ArrowLeft size={18} />
          Refund
        </button>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        {/* Amount */}
        <div className={styles.amountSection}>
          <span className={styles.currencySign}>₹</span>
          <input
            id="add-amount"
            type="number"
            className={styles.amountInput}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            step="0.01"
            min="0"
            required
            autoFocus
          />
        </div>

        {/* Category */}
        <div className={styles.field}>
          <label htmlFor="add-category">
            {type === 'income' ? 'Source' : type === 'refund' ? 'Refund Type' : 'Category'}
          </label>
          <div className={styles.categoryGrid}>
            {(type === 'expense' ? allExpenseCategories : type === 'income' ? allIncomeSources : DEFAULT_REFUND_SOURCES).map((cat) => (
              <button
                key={cat.name}
                type="button"
                className={`${styles.categoryChip} ${category === cat.name ? styles.categoryActive : ''}`}
                onClick={() => setCategory(cat.name)}
                style={category === cat.name ? { borderColor: cat.color, background: `${cat.color}15` } : {}}
              >
                <span>{cat.icon}</span>
                <span>{cat.name}</span>
              </button>
            ))}
            <button
              type="button"
              className={styles.categoryChip}
              onClick={() => setShowNewCategory(true)}
            >
              <Plus size={14} />
              <span>New</span>
            </button>
          </div>
        </div>

        {/* Description */}
        <div className={styles.field}>
          <label htmlFor="add-description">Description</label>
          <input
            id="add-description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What was this for?"
          />
        </div>

        {/* Date */}
        <div className={styles.field}>
          <label htmlFor="add-date">Date</label>
          <input
            id="add-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        {/* Funding Source (for expenses) */}
        {type === 'expense' && (
          <div className={styles.field}>
            <label htmlFor="add-source">Funding Source</label>
            <div className={styles.sourceGrid}>
              {allIncomeSources.map(src => (
                <button
                  key={src.name}
                  type="button"
                  className={`${styles.sourceChip} ${fundingSource === src.name ? styles.sourceActive : ''}`}
                  onClick={() => setFundingSource(src.name)}
                >
                  {src.icon} {src.name}
                </button>
              ))}
              <button
                type="button"
                className={`${styles.sourceChip} ${fundingSource === 'Emergency Funds' ? styles.sourceActive : ''}`}
                onClick={() => setFundingSource('Emergency Funds')}
              >
                🛡️ Emergency Funds
              </button>
            </div>
          </div>
        )}

        {/* Investment Toggle */}
        {type === 'expense' && (
          <div className={styles.investmentToggle}>
            <div className={styles.toggleInfo}>
              <span className={styles.toggleLabel}>Also an Investment?</span>
              <span className={styles.toggleSub}>This will also be tracked in your portfolio</span>
            </div>
            <button
              type="button"
              className={`${styles.toggleBtn} ${isInvestment ? styles.toggleOn : ''}`}
              onClick={() => setIsInvestment(!isInvestment)}
            >
              {isInvestment ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
            </button>
          </div>
        )}

        {/* Investment Details */}
        {isInvestment && (
          <div className={styles.investmentFields}>
            <div className={styles.field}>
              <label htmlFor="inv-bucket">Investment Bucket</label>
              <select
                id="inv-bucket"
                value={investmentBucket}
                onChange={(e) => setInvestmentBucket(e.target.value)}
              >
                <option value="">Select bucket...</option>
                {DEFAULT_INVESTMENT_BUCKETS.map(b => (
                  <option key={b.name} value={b.name}>{b.icon} {b.name}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="inv-ticker">Ticker / Symbol (optional)</label>
              <input
                id="inv-ticker"
                type="text"
                value={investmentTicker}
                onChange={(e) => setInvestmentTicker(e.target.value)}
                placeholder="e.g., ADANIPOWER.NS"
              />
            </div>
          </div>
        )}

        {/* Fuel tracker fields — shown only when Fuel category is selected */}
        {type === 'expense' && category === 'Fuel' && (
          <div className={styles.investmentFields}>
            <div className={styles.field}>
              <label htmlFor="fuel-litres">⛽ Litres Filled</label>
              <input
                id="fuel-litres"
                type="number"
                step="0.1"
                min="0"
                value={litres}
                onChange={e => setLitres(e.target.value)}
                placeholder="e.g., 10.5"
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="fuel-odometer">🛞 Odometer Reading (km)</label>
              <input
                id="fuel-odometer"
                type="number"
                step="1"
                min="0"
                value={odometerReading}
                onChange={e => setOdometerReading(e.target.value)}
                placeholder="e.g., 24580"
              />
            </div>
          </div>
        )}

        {error && <div className={styles.error}>{error}</div>}

        <button
          type="submit"
          className={`btn btn-primary btn-lg ${styles.submitBtn}`}
          disabled={loading || success}
        >
          {success ? (
            <>
              <Check size={20} />
              Added Successfully!
            </>
          ) : loading ? (
            <div className={styles.spinner} />
          ) : (
            `Add ${type === 'expense' ? 'Expense' : 'Income'}`
          )}
        </button>
      </form>

      {/* New Category Modal */}
      {showNewCategory && (
        <div className="modal-overlay" onClick={() => setShowNewCategory(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>New {type === 'expense' ? 'Category' : 'Income Source'}</h2>
              <button className="btn-icon btn-ghost" onClick={() => setShowNewCategory(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label>Name</label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Category name"
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowNewCategory(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  if (newCategoryName.trim()) {
                    const { addCategory, addIncomeSource } = await import('@/lib/firestore');
                    if (type === 'expense') {
                      await addCategory(user.uid, { name: newCategoryName, type: 'expense' });
                    } else {
                      await addIncomeSource(user.uid, { name: newCategoryName });
                    }
                    setCategory(newCategoryName);
                    setNewCategoryName('');
                    setShowNewCategory(false);
                  }
                }}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
