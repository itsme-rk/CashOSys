'use client';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  subscribeTransactions,
  subscribeInvestments,
  subscribeEmergencyFund,
  getCachedInsights,
  cacheInsights,
} from '@/lib/firestore';
import { getCurrentCycle } from '@/lib/salaryCycle';
import { formatCurrency } from '@/lib/constants';
import { callAI, parseAIJson } from '@/lib/ai';
import { Brain, Sparkles, RefreshCw, AlertTriangle, TrendingUp, Lightbulb, BarChart3, Clock } from 'lucide-react';

export default function InsightsPage() {
  const { user, userProfile } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [efEntries, setEfEntries] = useState([]);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checkingCache, setCheckingCache] = useState(false);
  const [error, setError] = useState('');
  const [cachedAt, setCachedAt] = useState(null);

  const salaryCycleDay = userProfile?.salaryCycleDay || 28;
  const currentCycleId = useMemo(() => getCurrentCycle(salaryCycleDay).id, [salaryCycleDay]);

  useEffect(() => {
    if (!user) return;
    const u1 = subscribeTransactions(user.uid, setTransactions);
    const u2 = subscribeInvestments(user.uid, setInvestments);
    const u3 = subscribeEmergencyFund(user.uid, setEfEntries);
    return () => { u1(); u2(); u3(); };
  }, [user]);

  // On load: check Firestore cache first — avoid an AI call entirely if current cycle is cached
  useEffect(() => {
    if (!user || !currentCycleId) return;
    setCheckingCache(true);
    getCachedInsights(user.uid, currentCycleId).then(cached => {
      if (cached?.insights) {
        setInsights(cached.insights);
        setCachedAt(cached.generatedAt);
      }
      setCheckingCache(false);
    }).catch(() => setCheckingCache(false));
  }, [user, currentCycleId]);

  // Build summarized payload — NOT raw transactions — to minimise prompt tokens
  const buildSummary = () => {
    const expenses      = transactions.filter(t => t.type === 'expense');
    const income        = transactions.filter(t => t.type === 'income');
    const totalIncome   = income.reduce((s, t)   => s + (t.amount || 0), 0);
    const totalExpenses = expenses.reduce((s, t) => s + (t.amount || 0), 0);
    const efBalance     = efEntries.reduce((s, e) => e.type === 'withdrawal' ? s - (e.amount || 0) : s + (e.amount || 0), 0);
    const totalInvested = investments.reduce((s, i) => s + (i.investedAmount || 0), 0);

    const catBreakdown = {};
    expenses.forEach(t => { catBreakdown[t.category || 'Misc'] = (catBreakdown[t.category || 'Misc'] || 0) + (t.amount || 0); });

    const topCats = Object.entries(catBreakdown)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([cat, amt]) => `${cat}: ₹${amt} (${totalExpenses > 0 ? (amt/totalExpenses*100).toFixed(1) : 0}%)`);

    const bucketMap = {};
    investments.forEach(i => { bucketMap[i.bucket] = (bucketMap[i.bucket] || 0) + (i.investedAmount || 0); });

    return { totalIncome, totalExpenses, efBalance, totalInvested, catBreakdown, topCats, bucketMap };
  };

  const generateInsights = async (forceRefresh = false) => {
    if (!user) return;
    setLoading(true); setError('');

    // If not forcing refresh, check cache again
    if (!forceRefresh) {
      try {
        const cached = await getCachedInsights(user.uid, currentCycleId);
        if (cached?.insights) {
          setInsights(cached.insights);
          setCachedAt(cached.generatedAt);
          setLoading(false);
          return;
        }
      } catch (_) { /* continue to generate */ }
    }

    const { totalIncome, totalExpenses, efBalance, totalInvested, topCats, bucketMap } = buildSummary();

    const prompt = `You are a personal finance AI advisor for an Indian user. Analyze this SUMMARIZED financial data.

FINANCIAL SUMMARY:
- Total Income: ₹${totalIncome}
- Total Expenses: ₹${totalExpenses}
- Savings Rate: ${totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100).toFixed(1) : 0}%
- Emergency Fund: ₹${efBalance}
- Total Investments: ₹${totalInvested}

TOP EXPENSE CATEGORIES:
${topCats.join('\n')}

INVESTMENT ALLOCATION:
${Object.entries(bucketMap).map(([b, a]) => `- ${b}: ₹${a}`).join('\n') || 'No investments yet'}

Respond ONLY with valid JSON (no extra text, no code blocks):
{"summary":"2-3 sentence financial health assessment","spending_alerts":["alert1","alert2"],"saving_tips":["tip1","tip2"],"investment_insights":["insight1","insight2"],"action_items":["action1","action2"]}

Be specific with ₹ amounts and %.`;

    try {
      const text = await callAI(prompt);
      const parsed = parseAIJson(text);
      if (parsed) {
        setInsights(parsed);
        setCachedAt(new Date().toISOString());
        // Persist to Firestore so next visit is instant
        cacheInsights(user.uid, currentCycleId, parsed).catch(console.warn);
      } else {
        setInsights({ summary: text.replace(/```[\s\S]*?```/g, '').trim(), spending_alerts: [], saving_tips: [], investment_insights: [], action_items: [] });
      }
    } catch (err) {
      console.error('Insights error:', err);
      setError(err.message || 'AI service unavailable. Try again later.');
      // Local fallback
      const { totalIncome, totalExpenses, efBalance, totalInvested } = buildSummary();
      setInsights({
        summary: `You've earned ${formatCurrency(totalIncome)} and spent ${formatCurrency(totalExpenses)} — ${totalIncome > 0 ? ((totalIncome-totalExpenses)/totalIncome*100).toFixed(1) : 0}% savings rate.`,
        spending_alerts: [],
        saving_tips: [totalExpenses > totalIncome ? '⚠️ Spending exceeds income!' : `Saving ${formatCurrency(totalIncome - totalExpenses)} this cycle.`],
        investment_insights: [`Portfolio: ${formatCurrency(totalInvested)}`],
        action_items: ['Review top categories', 'Set budget limits'],
      });
    } finally {
      setLoading(false);
    }
  };

  // Auto-trigger only if no cache and data is ready — once per session
  useEffect(() => {
    if (transactions.length > 0 && !insights && !loading && !checkingCache) {
      const timer = setTimeout(() => generateInsights(), 2000);
      return () => clearTimeout(timer);
    }
  }, [transactions.length, insights, loading, checkingCache]); // eslint-disable-line

  const iconMap  = { spending_alerts: AlertTriangle, saving_tips: Lightbulb, investment_insights: TrendingUp, action_items: Sparkles };
  const colorMap = { spending_alerts: 'var(--error)', saving_tips: 'var(--accent-green)', investment_insights: 'var(--accent-gold)', action_items: 'var(--info)' };
  const labelMap = { spending_alerts: 'Spending Alerts', saving_tips: 'Saving Tips', investment_insights: 'Investment Insights', action_items: 'Action Items' };

  const formattedCachedAt = cachedAt ? new Date(cachedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Brain size={28} style={{ color: 'var(--accent-green)' }} /> AI Insights
          </h1>
          {formattedCachedAt && (
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={12} /> Cached: {formattedCachedAt} — for {currentCycleId}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => generateInsights(false)} disabled={loading || checkingCache}>
            Load Cache
          </button>
          <button className="btn btn-primary" onClick={() => generateInsights(true)} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            {loading ? 'Analyzing...' : 'Refresh AI'}
          </button>
        </div>
      </div>

      {error && <div style={{ background: 'var(--error-bg)', color: 'var(--error)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>{error}</div>}

      {(loading || checkingCache) && (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
          <div style={{ width: 40, height: 40, border: '3px solid var(--accent-green)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--text-secondary)' }}>{checkingCache ? 'Checking cached insights...' : 'Generating AI analysis...'}</p>
        </div>
      )}

      {insights && !loading && !checkingCache && (
        <>
          <div className="card card-glow-green">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
              <Sparkles size={20} style={{ color: 'var(--accent-green)' }} />
              <span style={{ fontWeight: 700 }}>Summary</span>
            </div>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '0.9375rem' }}>{insights.summary}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
            {['spending_alerts', 'saving_tips', 'investment_insights', 'action_items'].map(key => {
              const Icon = iconMap[key];
              const items = insights[key] || [];
              if (items.length === 0) return null;
              return (
                <div key={key} className="card">
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: '1rem', fontWeight: 700 }}>
                    <Icon size={18} style={{ color: colorMap[key] }} />{labelMap[key]}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {items.map((item, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        <span style={{ color: colorMap[key], fontWeight: 700, flexShrink: 0 }}>•</span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {!insights && !loading && !checkingCache && (
        <div className="card empty-state">
          <Brain size={48} />
          <h3>No insights yet</h3>
          <p>Add some transactions then click Refresh AI</p>
        </div>
      )}

      <style jsx>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
