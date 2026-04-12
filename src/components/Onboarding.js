'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { updateUserProfile, addIncomeSource } from '@/lib/firestore';
import { Sparkles, ChevronRight, ChevronLeft, Check, Wallet, Calendar, DollarSign } from 'lucide-react';
import styles from './Onboarding.module.css';

const STEPS = [
  { title: 'Welcome', subtitle: 'Let\'s personalize your experience' },
  { title: 'Salary Cycle', subtitle: 'When does your salary hit?' },
  { title: 'Income Sources', subtitle: 'How do you earn?' },
  { title: 'All Set!', subtitle: 'You\'re ready to track' },
];

export default function OnboardingWizard({ onComplete }) {
  const { user, refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [salaryCycleDay, setSalaryCycleDay] = useState(28);
  const [sources, setSources] = useState([
    { name: 'Salary', enabled: true },
    { name: 'Freelance', enabled: false },
    { name: 'Business', enabled: false },
    { name: 'Investments', enabled: false },
  ]);
  const [customSource, setCustomSource] = useState('');
  const [saving, setSaving] = useState(false);

  const handleFinish = async () => {
    setSaving(true);
    try {
      await updateUserProfile(user.uid, {
        salaryCycleDay: parseInt(salaryCycleDay),
        onboardingComplete: true,
      });

      // Create income sources
      const enabledSources = sources.filter(s => s.enabled);
      for (const src of enabledSources) {
        await addIncomeSource(user.uid, {
          name: src.name,
          type: src.name.toLowerCase() === 'salary' ? 'salary' : 'other',
        });
      }

      await refreshProfile();
      onComplete();
    } catch (err) {
      console.error('Onboarding error:', err);
    }
    setSaving(false);
  };

  const addCustomSource = () => {
    if (customSource.trim()) {
      setSources([...sources, { name: customSource.trim(), enabled: true }]);
      setCustomSource('');
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.wizard}>
        {/* Progress */}
        <div className={styles.progress}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`${styles.progressDot} ${i <= step ? styles.progressActive : ''}`}
            />
          ))}
        </div>

        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className={styles.stepContent}>
            <div className={styles.logoMark}>
              <span>₹</span>
            </div>
            <h2 className={styles.stepTitle}>Welcome to CashOSys!</h2>
            <p className={styles.stepDesc}>
              Your personal finance operating system. Let's set up a few things
              to make your experience perfect.
            </p>
            <div className={styles.featureList}>
              <div className={styles.featureItem}>
                <Sparkles size={18} />
                <span>AI-powered financial insights</span>
              </div>
              <div className={styles.featureItem}>
                <Calendar size={18} />
                <span>Salary-cycle driven tracking</span>
              </div>
              <div className={styles.featureItem}>
                <DollarSign size={18} />
                <span>Multi-source income management</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Salary Cycle */}
        {step === 1 && (
          <div className={styles.stepContent}>
            <div className={styles.stepIcon}>
              <Calendar size={32} />
            </div>
            <h2 className={styles.stepTitle}>Salary Cycle Day</h2>
            <p className={styles.stepDesc}>
              Which day of the month does your salary credit? This helps us organize
              your finances by pay cycles instead of calendar months.
            </p>
            <div className={styles.dayGrid}>
              {[1, 5, 10, 15, 20, 25, 26, 27, 28, 29, 30, 31].map(d => (
                <button
                  key={d}
                  className={`${styles.dayBtn} ${salaryCycleDay === d ? styles.dayActive : ''}`}
                  onClick={() => setSalaryCycleDay(d)}
                >
                  {d}
                </button>
              ))}
            </div>
            <p className={styles.dayHint}>
              Selected: <strong>{salaryCycleDay}th</strong> of every month
            </p>
          </div>
        )}

        {/* Step 2: Income Sources */}
        {step === 2 && (
          <div className={styles.stepContent}>
            <div className={styles.stepIcon}>
              <Wallet size={32} />
            </div>
            <h2 className={styles.stepTitle}>Income Sources</h2>
            <p className={styles.stepDesc}>
              Select your income sources. Each expense will be tagged with which source funded it.
            </p>
            <div className={styles.sourceList}>
              {sources.map((src, i) => (
                <button
                  key={src.name}
                  className={`${styles.sourceBtn} ${src.enabled ? styles.sourceActive : ''}`}
                  onClick={() => {
                    const updated = [...sources];
                    updated[i].enabled = !updated[i].enabled;
                    setSources(updated);
                  }}
                >
                  {src.enabled ? <Check size={16} /> : <div style={{ width: 16, height: 16 }} />}
                  <span>{src.name}</span>
                </button>
              ))}
            </div>
            <div className={styles.addSourceRow}>
              <input
                type="text"
                placeholder="Add custom source..."
                value={customSource}
                onChange={(e) => setCustomSource(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustomSource()}
              />
              <button className="btn btn-secondary btn-sm" onClick={addCustomSource}>
                Add
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Done */}
        {step === 3 && (
          <div className={styles.stepContent}>
            <div className={styles.doneIcon}>
              <Check size={40} />
            </div>
            <h2 className={styles.stepTitle}>You're All Set! 🎉</h2>
            <p className={styles.stepDesc}>
              Your CashOSys is configured. Start tracking your finances now!
            </p>
            <div className={styles.summaryList}>
              <div className={styles.summaryItem}>
                <span>Salary Cycle Day</span>
                <strong>{salaryCycleDay}th</strong>
              </div>
              <div className={styles.summaryItem}>
                <span>Income Sources</span>
                <strong>{sources.filter(s => s.enabled).map(s => s.name).join(', ') || 'None'}</strong>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className={styles.navButtons}>
          {step > 0 && (
            <button className="btn btn-secondary" onClick={() => setStep(s => s - 1)}>
              <ChevronLeft size={16} /> Back
            </button>
          )}
          <div style={{ flex: 1 }} />
          {step < 3 ? (
            <button className="btn btn-primary" onClick={() => setStep(s => s + 1)}>
              {step === 0 ? 'Get Started' : 'Continue'} <ChevronRight size={16} />
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={handleFinish}
              disabled={saving}
            >
              {saving ? 'Setting up...' : 'Launch Dashboard'} <Sparkles size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
