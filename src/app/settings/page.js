'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { updateUserProfile, subscribeIncomeSources, addIncomeSource, deleteDocument, batchImport, getDocuments, clearAllUserData, getBudgets, saveBudgets, subscribeRecurringTemplates, addRecurringTemplate, deleteRecurringTemplate } from '@/lib/firestore';
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_SOURCES, formatCurrency } from '@/lib/constants';
import { parseExcelWorkbook, buildExportWorkbook } from '@/lib/excel';
import { Settings, Sun, Moon, Save, Plus, Trash2, X, Upload, Download, User, CheckCircle, AlertTriangle, Car, Fuel, Target, Zap, Bell } from 'lucide-react';
import styles from './settings.module.css';

export default function SettingsPage() {
  const { user, userProfile, refreshProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [incomeSources, setIncomeSources] = useState([]);

  // Profile form
  const [displayName, setDisplayName] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [salaryCycleDay, setSalaryCycleDay] = useState(28);
  const [primaryIncomeSource, setPrimaryIncomeSource] = useState('Income');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Vehicle profile
  const [vehicleName, setVehicleName] = useState('');
  const [vehicleType, setVehicleType] = useState('bike');
  const [tankCapacity, setTankCapacity] = useState('');

  // Budget targets
  const [budgetTargets, setBudgetTargets] = useState([]);
  const [showAddBudget, setShowAddBudget] = useState(false);
  const [newBudgetCategory, setNewBudgetCategory] = useState('');
  const [newBudgetLimit, setNewBudgetLimit] = useState('');
  const [budgetSaving, setBudgetSaving] = useState(false);

  // Recurring templates
  const [recurringTemplates, setRecurringTemplates] = useState([]);
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [templateForm, setTemplateForm] = useState({ type: 'expense', category: '', description: '', amount: '', fundingSource: '', label: '' });

  // New income source
  const [showAddSource, setShowAddSource] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceType, setNewSourceType] = useState('other');

  // Import state
  const [importData, setImportData] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || '');
      setPhotoURL(userProfile.photoURL || '');
      setSalaryCycleDay(userProfile.salaryCycleDay || 28);
      setPrimaryIncomeSource(userProfile.primaryIncomeSource || 'Income');
      setVehicleName(userProfile.vehicleName || '');
      setVehicleType(userProfile.vehicleType || 'bike');
      setTankCapacity(userProfile.tankCapacity || '');
    }
  }, [userProfile]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeIncomeSources(user.uid, setIncomeSources);
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    getBudgets(user.uid).then(setBudgetTargets);
    const unsub = subscribeRecurringTemplates(user.uid, setRecurringTemplates);
    return () => unsub();
  }, [user]);

  const allIncomeSources = [...DEFAULT_INCOME_SOURCES, ...incomeSources];

  const handleProfileSave = async () => {
    setProfileSaving(true);
    try {
      await updateUserProfile(user.uid, {
        displayName,
        photoURL,
        salaryCycleDay: parseInt(salaryCycleDay),
        primaryIncomeSource,
        vehicleName,
        vehicleType,
        tankCapacity: tankCapacity ? parseFloat(tankCapacity) : null,
      });
      await refreshProfile();
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    } catch (err) {
      console.error('Error updating profile:', err);
    }
    setProfileSaving(false);
  };

  const handleClearData = async () => {
    if (!user) return;
    const confirmed = window.confirm(
      "WARNING: This will permanently delete ALL your transactions, investments, goals, watchlist, and other tracked data.\n\nType 'DELETE' to confirm:"
    );
    if (confirmed) {
      const doubleCheck = window.prompt("Type 'DELETE' to permanently wipe all data.");
      if (doubleCheck === 'DELETE') {
        setIsClearing(true);
        try {
          await clearAllUserData(user.uid);
          alert('All your data has been successfully cleared. You can start fresh or import a new file!');
        } catch (err) {
          console.error("Failed to clear data:", err);
          alert("Failed to clear data: " + err.message);
        }
        setIsClearing(false);
      }
    }
  };

  const handleAddSource = async () => {
    if (!newSourceName) return;
    try {
      await addIncomeSource(user.uid, { name: newSourceName, type: newSourceType });
      setNewSourceName('');
      setShowAddSource(false);
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const handleDeleteSource = async (id) => {
    try {
      await deleteDocument(user.uid, 'incomeSources', id);
    } catch (err) {
      console.error('Error:', err);
    }
  };

  // Budget handlers
  const handleAddBudget = async () => {
    if (!newBudgetCategory || !newBudgetLimit) return;
    const updated = [...budgetTargets.filter(b => b.category !== newBudgetCategory), { category: newBudgetCategory, limit: parseFloat(newBudgetLimit) }];
    setBudgetSaving(true);
    await saveBudgets(user.uid, updated);
    setBudgetTargets(updated);
    setNewBudgetCategory('');
    setNewBudgetLimit('');
    setShowAddBudget(false);
    setBudgetSaving(false);
  };

  const handleDeleteBudget = async (category) => {
    const updated = budgetTargets.filter(b => b.category !== category);
    await saveBudgets(user.uid, updated);
    setBudgetTargets(updated);
  };

  // Recurring template handlers
  const handleAddTemplate = async () => {
    if (!templateForm.category && !templateForm.description) return;
    await addRecurringTemplate(user.uid, templateForm);
    setTemplateForm({ type: 'expense', category: '', description: '', amount: '', fundingSource: '', label: '' });
    setShowAddTemplate(false);
  };

  // Excel Import — Parse & Preview
  const handleExcelImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const XLSX = await import('xlsx');
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const cyclDay = userProfile?.salaryCycleDay || 28;
      const parsed = parseExcelWorkbook(workbook, XLSX, cyclDay);
      setImportData(parsed);
    } catch (err) {
      console.error('Import error:', err);
      setImportResult({ success: false, message: 'Error reading Excel file. Make sure it\'s a valid .xlsx file.' });
    }
    e.target.value = '';
  };

  // Confirm Import
  const confirmImport = async () => {
    if (!importData || !user) return;
    setImporting(true);
    setImportProgress({ collection: 'Starting...', imported: 0, total: importData.summary.total, percent: 0 });
    
    let totalImported = 0;
    let totalErrors = 0;
    const grandTotal = importData.summary.total;

    const collectionLabel = {
      transactions: 'Transactions', investments: 'Investments', emergencyFund: 'Emergency Fund',
      personalLending: 'Personal Lending', loans: 'Loans', goals: 'Goals',
    };

    const handleProgress = (collName) => (progress) => {
      setImportProgress({
        collection: collectionLabel[collName] || collName,
        imported: totalImported + progress.imported,
        total: grandTotal,
        percent: Math.round(((totalImported + progress.imported) / grandTotal) * 100),
      });
    };

    try {
      const importJobs = [
        { data: [...importData.income, ...importData.expenses], collection: 'transactions' },
        { data: importData.investments, collection: 'investments' },
        { data: importData.emergencyFund, collection: 'emergencyFund' },
        { data: importData.lending, collection: 'personalLending' },
        { data: importData.loans, collection: 'loans' },
        { data: importData.goals, collection: 'goals' },
      ];

      for (const job of importJobs) {
        if (job.data.length > 0) {
          setImportProgress(prev => ({ ...prev, collection: collectionLabel[job.collection] }));
          const result = await batchImport(user.uid, job.collection, job.data, handleProgress(job.collection));
          totalImported += result.imported;
          totalErrors += result.errors;
        }
      }

      setImportResult({
        success: true,
        message: `Successfully imported ${totalImported} records!${totalErrors > 0 ? ` (${totalErrors} errors)` : ''}`,
      });
      setImportData(null);
    } catch (err) {
      console.error('Import error:', err);
      setImportResult({
        success: false,
        message: `Import partially completed (${totalImported} imported). Error: ${err.message}`,
      });
    }
    setImporting(false);
    setImportProgress(null);
  };

  // Excel Export
  const handleExcelExport = async () => {
    setExporting(true);
    try {
      const XLSX = await import('xlsx');
      const [transactions, investments, emergencyFund, goals, loans, lending] = await Promise.all([
        getDocuments(user.uid, 'transactions'), getDocuments(user.uid, 'investments'),
        getDocuments(user.uid, 'emergencyFund'), getDocuments(user.uid, 'goals'),
        getDocuments(user.uid, 'loans'), getDocuments(user.uid, 'personalLending'),
      ]);
      const wb = buildExportWorkbook({ transactions, investments, emergencyFund, goals, loans, lending }, XLSX);
      XLSX.writeFile(wb, `CashOSys_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
      setImportResult({ success: true, message: 'Export downloaded successfully!' });
    } catch (err) {
      console.error('Export error:', err);
      setImportResult({ success: false, message: `Export failed: ${err.message}` });
    }
    setExporting(false);
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>
        <Settings size={28} />
        Settings
      </h1>

      {/* Profile Section */}
      <div className="card">
        <h3 className={styles.sectionTitle}>
          <User size={18} />
          Profile
        </h3>
        <div className={styles.formGrid}>
          <div className="input-group">
            <label>Display Name</label>
            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
          </div>
          <div className="input-group">
            <label>Email</label>
            <input type="email" value={user?.email || ''} disabled style={{ opacity: 0.6 }} />
          </div>
          <div className="input-group">
            <label>Profile Picture URL</label>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {photoURL ? (
                  <img src={photoURL} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <User size={24} style={{ color: 'var(--text-tertiary)' }} />
                )}
              </div>
              <input type="text" value={photoURL} onChange={(e) => setPhotoURL(e.target.value)} placeholder="https://example.com/photo.png" style={{ flex: 1 }} />
            </div>
          </div>
          <div className="input-group">
            <label>Salary Cycle Day</label>
            <select value={salaryCycleDay} onChange={(e) => setSalaryCycleDay(e.target.value)}>
              {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                <option key={d} value={d}>{d}th of every month</option>
              ))}
            </select>
          </div>
          <div className="input-group">
            <label>Primary Income Source</label>
            <select value={primaryIncomeSource} onChange={(e) => setPrimaryIncomeSource(e.target.value)}>
              {allIncomeSources.map(src => (
                <option key={src.name} value={src.name}>{src.icon || '💼'} {src.name} ({src.type})</option>
              ))}
            </select>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 4 }}>
              Dashboard shows this source's balance for the current salary cycle only. Others show all-time balance.
            </span>
          </div>
        </div>
        <button className="btn btn-primary" onClick={handleProfileSave} disabled={profileSaving} style={{ marginTop: 'var(--space-4)' }}>
          {profileSaved ? '✓ Saved!' : profileSaving ? 'Saving...' : <><Save size={16} /> Save Profile</>}
        </button>
      </div>

      {/* Vehicle Profile */}
      <div className="card">
        <h3 className={styles.sectionTitle}>
          <Car size={18} />
          Vehicle Profile
        </h3>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
          Used for fuel analytics on the dashboard
        </p>
        <div className={styles.formGrid}>
          <div className="input-group">
            <label>Vehicle Name</label>
            <input type="text" value={vehicleName} onChange={(e) => setVehicleName(e.target.value)} placeholder="e.g., Honda Activa" />
          </div>
          <div className="input-group">
            <label>Type</label>
            <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
              <option value="bike">🏍️ Bike / Scooter</option>
              <option value="car">🚗 Car</option>
              <option value="ev">⚡ Electric</option>
            </select>
          </div>
          <div className="input-group">
            <label>Tank Capacity (Litres)</label>
            <input type="number" step="0.1" min="0" value={tankCapacity} onChange={(e) => setTankCapacity(e.target.value)} placeholder="e.g., 5.3" />
          </div>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 'var(--space-2)' }}>
          Saved with your profile when you click "Save Profile" above.
        </p>
      </div>

      {/* Budget Targets */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h3 className={styles.sectionTitle} style={{ marginBottom: 0 }}>
            <Target size={18} />
            Monthly Budget Targets
          </h3>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowAddBudget(true)}>
            <Plus size={14} /> Add Target
          </button>
        </div>
        {budgetTargets.length > 0 ? (
          <div className={styles.sourceList}>
            {budgetTargets.map(b => (
              <div key={b.category} className={styles.sourceItem}>
                <span className={styles.sourceIcon}>{DEFAULT_EXPENSE_CATEGORIES.find(c => c.name === b.category)?.icon || '📌'}</span>
                <div className={styles.sourceInfo}>
                  <span style={{ fontWeight: 600 }}>{b.category}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--accent-gold)' }}>{formatCurrency(b.limit)} / month</span>
                </div>
                <button className="btn btn-ghost btn-icon-sm" onClick={() => handleDeleteBudget(b.category)} style={{ color: 'var(--text-tertiary)' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>No budget targets set. Add one to track spending limits.</p>
        )}
        {showAddBudget && (
          <div className={styles.addSourceForm}>
            <select value={newBudgetCategory} onChange={(e) => setNewBudgetCategory(e.target.value)} style={{ flex: 1 }}>
              <option value="">Select category...</option>
              {DEFAULT_EXPENSE_CATEGORIES.filter(c => !budgetTargets.find(b => b.category === c.name)).map(c => (
                <option key={c.name} value={c.name}>{c.icon} {c.name}</option>
              ))}
            </select>
            <input type="number" placeholder="₹ Limit" value={newBudgetLimit} onChange={(e) => setNewBudgetLimit(e.target.value)} style={{ width: 120 }} />
            <button className="btn btn-primary btn-sm" onClick={handleAddBudget} disabled={budgetSaving}>Add</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAddBudget(false)}><X size={14} /></button>
          </div>
        )}
      </div>

      {/* Recurring Templates (Quick Select) */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h3 className={styles.sectionTitle} style={{ marginBottom: 0 }}>
            <Zap size={18} />
            Quick Select Templates
          </h3>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowAddTemplate(true)}>
            <Plus size={14} /> Add
          </button>
        </div>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
          Pre-fill transactions on the Add page. Just select a template, enter amount & date, and submit.
        </p>
        {recurringTemplates.length > 0 ? (
          <div className={styles.sourceList}>
            {recurringTemplates.map(t => (
              <div key={t.id} className={styles.sourceItem}>
                <span className={styles.sourceIcon}>{t.icon || '📌'}</span>
                <div className={styles.sourceInfo}>
                  <span style={{ fontWeight: 600 }}>{t.label || t.description || t.category}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                    {t.type} • {t.category}{t.amount ? ` • ${formatCurrency(t.amount)}` : ''}
                  </span>
                </div>
                <button className="btn btn-ghost btn-icon-sm" onClick={() => deleteRecurringTemplate(user.uid, t.id)} style={{ color: 'var(--text-tertiary)' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>No templates yet. Add recurring transactions for quick entry.</p>
        )}
        {showAddTemplate && (
          <div style={{ marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <select value={templateForm.type} onChange={e => setTemplateForm({ ...templateForm, type: e.target.value })} style={{ width: 120 }}>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
              <input placeholder="Label (e.g., Monthly Rent)" value={templateForm.label} onChange={e => setTemplateForm({ ...templateForm, label: e.target.value })} style={{ flex: 1 }} />
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <select value={templateForm.category} onChange={e => setTemplateForm({ ...templateForm, category: e.target.value })} style={{ flex: 1 }}>
                <option value="">Category...</option>
                {(templateForm.type === 'expense' ? DEFAULT_EXPENSE_CATEGORIES : DEFAULT_INCOME_SOURCES).map(c => (
                  <option key={c.name} value={c.name}>{c.icon} {c.name}</option>
                ))}
              </select>
              <input type="number" placeholder="₹ Amount (optional)" value={templateForm.amount} onChange={e => setTemplateForm({ ...templateForm, amount: e.target.value })} style={{ width: 150 }} />
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAddTemplate(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleAddTemplate}>Add Template</button>
            </div>
          </div>
        )}
      </div>

      {/* Theme */}
      <div className="card">
        <h3 className={styles.sectionTitle}>Appearance</h3>
        <div className={styles.themeRow}>
          <div>
            <p style={{ fontWeight: 600 }}>Theme</p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Currently using {theme} mode
            </p>
          </div>
          <button className="btn btn-secondary" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            Switch to {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>
      </div>

      {/* Income Sources */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h3 className={styles.sectionTitle} style={{ marginBottom: 0 }}>Income Sources</h3>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowAddSource(true)}>
            <Plus size={14} /> Add Source
          </button>
        </div>
        <div className={styles.sourceList}>
          {incomeSources.length > 0 ? (
            incomeSources.map(source => (
              <div key={source.id} className={styles.sourceItem}>
                <span className={styles.sourceIcon}>{source.icon || '💰'}</span>
                <div className={styles.sourceInfo}>
                  <span style={{ fontWeight: 600 }}>{source.name}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{source.type}</span>
                </div>
                <button className="btn btn-ghost btn-icon-sm" onClick={() => handleDeleteSource(source.id)} style={{ color: 'var(--text-tertiary)' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          ) : (
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
              No custom income sources added. Default sources (Income, Income 2.0) are used.
            </p>
          )}
        </div>
        {showAddSource && (
          <div className={styles.addSourceForm}>
            <input type="text" placeholder="Source name" value={newSourceName} onChange={(e) => setNewSourceName(e.target.value)} style={{ flex: 1 }} />
            <select value={newSourceType} onChange={(e) => setNewSourceType(e.target.value)} style={{ width: '120px' }}>
              <option value="salary">Salary</option>
              <option value="freelance">Freelance</option>
              <option value="investment">Investment</option>
              <option value="other">Other</option>
            </select>
            <button className="btn btn-primary btn-sm" onClick={handleAddSource}>Add</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAddSource(false)}>
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Excel Import/Export */}
      <div className="card">
        <h3 className={styles.sectionTitle}>Data Management</h3>

        {importResult && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
            padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-4)',
            background: importResult.success ? 'var(--success-bg)' : 'var(--error-bg)',
            color: importResult.success ? 'var(--accent-green)' : 'var(--error)',
          }}>
            {importResult.success ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
            <span style={{ fontSize: '0.875rem', fontWeight: 500, flex: 1 }}>{importResult.message}</span>
            <button style={{ color: 'inherit', opacity: 0.7 }} onClick={() => setImportResult(null)}>
              <X size={14} />
            </button>
          </div>
        )}

        <div className={styles.dataActions}>
          <div className={styles.dataAction}>
            <Upload size={20} style={{ color: 'var(--accent-green)' }} />
            <div>
              <p style={{ fontWeight: 600 }}>Import from Excel</p>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Upload your .xlsx finance tracker</p>
            </div>
            <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
              <Upload size={14} /> Browse
              <input type="file" accept=".xlsx,.xls" onChange={handleExcelImport} style={{ display: 'none' }} />
            </label>
          </div>
          <div className={styles.dataAction}>
            <Download size={20} style={{ color: 'var(--accent-gold)' }} />
            <div>
              <p style={{ fontWeight: 600 }}>Export to Excel</p>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Download all your data as .xlsx</p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={handleExcelExport} disabled={exporting}>
              <Download size={14} /> {exporting ? 'Exporting...' : 'Export'}
            </button>
          </div>
          <div className={styles.dataAction} style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <Trash2 size={20} style={{ color: 'var(--error)' }} />
            <div>
              <p style={{ fontWeight: 600, color: 'var(--error)' }}>Clear All Data</p>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Permanently delete all your subcollections</p>
            </div>
            <button className="btn btn-sm" style={{ background: 'var(--error-bg)', color: 'var(--error)' }} onClick={handleClearData} disabled={isClearing}>
              {isClearing ? 'Clearing...' : 'Clear Data'}
            </button>
          </div>
        </div>
      </div>

      {/* Categories Reference */}
      <div className="card">
        <h3 className={styles.sectionTitle}>Default Expense Categories</h3>
        <div className={styles.categoryGrid}>
          {DEFAULT_EXPENSE_CATEGORIES.map(cat => (
            <div key={cat.name} className={styles.categoryChip}>
              <span>{cat.icon}</span>
              <span>{cat.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Import Preview Modal */}
      {importData && (
        <div className="modal-overlay" onClick={() => setImportData(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <div className="modal-header">
              <h2>Import Preview</h2>
              <button className="btn btn-ghost btn-icon-sm" onClick={() => setImportData(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)', fontSize: '0.875rem' }}>
                Found the following data in your Excel file:
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                {[
                  { label: 'Income Entries', count: importData.summary.income, icon: '💰' },
                  { label: 'Expense Entries', count: importData.summary.expenses, icon: '📉' },
                  { label: 'Investments', count: importData.summary.investments, icon: '📊' },
                  { label: 'Emergency Fund', count: importData.summary.emergencyFund, icon: '🛡️' },
                  { label: 'Lending Records', count: importData.summary.lending, icon: '🤝' },
                  { label: 'Loans', count: importData.summary.loans, icon: '💳' },
                  { label: 'Goals', count: importData.summary.goals, icon: '🎯' },
                ].filter(item => item.count > 0).map(item => (
                  <div key={item.label} style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                    padding: 'var(--space-3)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)',
                  }}>
                    <span>{item.icon}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1.125rem' }}>{item.count}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{item.label}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', background: 'var(--success-bg)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontWeight: 600, textAlign: 'center' }}>
                Total: {importData.summary.total} records ready to import
              </div>
              {importData.errors.length > 0 && (
                <div style={{ marginTop: 'var(--space-3)', fontSize: '0.75rem', color: 'var(--warning)' }}>
                  ⚠️ {importData.errors.length} rows skipped due to parsing errors
                </div>
              )}
            </div>
            <div className="modal-footer" style={{ flexDirection: 'column', gap: 'var(--space-3)' }}>
              {importing && importProgress && (
                <div style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: 6 }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Importing {importProgress.collection}...</span>
                    <span style={{ fontWeight: 700, color: 'var(--accent-green)' }}>{importProgress.percent}%</span>
                  </div>
                  <div className="progress-bar" style={{ height: 8 }}>
                    <div className="progress-bar-fill" style={{ width: `${importProgress.percent}%`, transition: 'width 0.3s' }} />
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 4, textAlign: 'center' }}>
                    {importProgress.imported} of {importProgress.total} records
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', width: '100%' }}>
                <button className="btn btn-secondary" onClick={() => setImportData(null)} disabled={importing}>
                  {importing ? 'Please wait...' : 'Cancel'}
                </button>
                <button className="btn btn-primary" onClick={confirmImport} disabled={importing || importData.summary.total === 0}>
                  {importing ? `Importing... ${importProgress?.percent || 0}%` : `Import ${importData.summary.total} Records`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
