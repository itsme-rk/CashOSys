'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { subscribeTransactions, subscribeInvestments, subscribeEmergencyFund } from '@/lib/firestore';
import { formatCurrency } from '@/lib/constants';
import { Brain, Sparkles, RefreshCw, AlertTriangle, TrendingUp, Lightbulb, BarChart3 } from 'lucide-react';

export default function InsightsPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [efEntries, setEfEntries] = useState([]);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    const u1 = subscribeTransactions(user.uid, setTransactions);
    const u2 = subscribeInvestments(user.uid, setInvestments);
    const u3 = subscribeEmergencyFund(user.uid, setEfEntries);
    return () => { u1(); u2(); u3(); };
  }, [user]);

  const generateInsights = async () => {
    setLoading(true); setError('');
    try {
      const expenses = transactions.filter(t => t.type === 'expense');
      const income = transactions.filter(t => t.type === 'income');
      const totalIncome = income.reduce((s, t) => s + (t.amount || 0), 0);
      const totalExpenses = expenses.reduce((s, t) => s + (t.amount || 0), 0);
      const efBalance = efEntries.reduce((s, e) => s + (e.amount || 0), 0);
      const totalInvested = investments.reduce((s, i) => s + (i.investedAmount || 0), 0);

      const catBreakdown = {};
      expenses.forEach(t => { catBreakdown[t.category || 'Misc'] = (catBreakdown[t.category || 'Misc'] || 0) + (t.amount || 0); });

      const prompt = `You are a personal finance AI advisor for an Indian user. Analyze this financial data and provide actionable insights.

FINANCIAL DATA:
- Total Income: ₹${totalIncome}
- Total Expenses: ₹${totalExpenses}  
- Savings Rate: ${totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100).toFixed(1) : 0}%
- Emergency Fund Balance: ₹${efBalance}
- Total Investments: ₹${totalInvested}
- Number of transactions: ${transactions.length}

EXPENSE BREAKDOWN:
${Object.entries(catBreakdown).sort((a,b) => b[1]-a[1]).map(([cat, amt]) => `- ${cat}: ₹${amt} (${totalExpenses > 0 ? (amt/totalExpenses*100).toFixed(1) : 0}%)`).join('\n')}

INVESTMENT PORTFOLIO:
${investments.map(i => `- ${i.bucket}: ${i.instrumentName} - ₹${i.investedAmount}`).join('\n') || 'No investments yet'}

Please provide insights in this JSON format:
{
  "summary": "2-3 sentence overall financial health assessment",
  "spending_alerts": ["alert1", "alert2"],
  "saving_tips": ["tip1", "tip2"],
  "investment_insights": ["insight1", "insight2"],
  "action_items": ["action1", "action2"]
}

Be specific with numbers and percentages. Use ₹ for amounts.`;

      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
        // Generate basic insights without API
        const topCat = Object.entries(catBreakdown).sort((a,b) => b[1]-a[1]);
        setInsights({
          summary: `You've earned ${formatCurrency(totalIncome)} and spent ${formatCurrency(totalExpenses)} with a ${totalIncome > 0 ? ((totalIncome-totalExpenses)/totalIncome*100).toFixed(1) : 0}% savings rate. Your emergency fund has ${formatCurrency(efBalance)}.`,
          spending_alerts: topCat.slice(0, 3).map(([cat, amt]) => `${cat} spending: ${formatCurrency(amt)} (${(amt/totalExpenses*100).toFixed(1)}% of total)`),
          saving_tips: [
            totalExpenses > totalIncome ? 'Warning: You are spending more than you earn!' : `You are saving ${formatCurrency(totalIncome - totalExpenses)} per cycle`,
            efBalance > 0 ? `Emergency fund covers ${(efBalance / (totalExpenses || 1) * (Object.keys(catBreakdown).length > 0 ? 1 : 0)).toFixed(1)} months` : 'Consider building an emergency fund'
          ],
          investment_insights: investments.length > 0 ? [`Portfolio: ${formatCurrency(totalInvested)} across ${investments.length} instruments`] : ['Start investing to grow your wealth'],
          action_items: ['Review top spending categories', 'Set monthly budget limits', 'Automate savings transfers'],
        });
        setLoading(false);
        return;
      }

      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      
      // Parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        setInsights(JSON.parse(jsonMatch[0]));
      } else {
        setInsights({ summary: text, spending_alerts: [], saving_tips: [], investment_insights: [], action_items: [] });
      }
    } catch (err) {
      setError(err.message || 'Failed to generate insights');
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (transactions.length > 0 && !insights && !loading) {
      generateInsights();
    }
  }, [transactions.length]);

  const iconMap = { spending_alerts: AlertTriangle, saving_tips: Lightbulb, investment_insights: TrendingUp, action_items: Sparkles };
  const colorMap = { spending_alerts: 'var(--error)', saving_tips: 'var(--accent-green)', investment_insights: 'var(--accent-gold)', action_items: 'var(--info)' };
  const labelMap = { spending_alerts: 'Spending Alerts', saving_tips: 'Saving Tips', investment_insights: 'Investment Insights', action_items: 'Action Items' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div><h1 style={{ fontSize: '1.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}><Brain size={28} style={{ color: 'var(--accent-green)' }} /> AI Insights</h1><p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: 4 }}>Powered by Gemini</p></div>
        <button className="btn btn-primary" onClick={generateInsights} disabled={loading}><RefreshCw size={16} className={loading ? 'spin' : ''} /> {loading ? 'Analyzing...' : 'Refresh'}</button>
      </div>

      {error && <div style={{ background: 'var(--error-bg)', color: 'var(--error)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>{error}</div>}

      {insights && (
        <>
          <div className="card card-glow-green" style={{ background: 'linear-gradient(135deg, var(--bg-surface), var(--bg-secondary))' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}><Sparkles size={20} style={{ color: 'var(--accent-green)' }} /><span style={{ fontWeight: 700 }}>Summary</span></div>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '0.9375rem' }}>{insights.summary}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
            {['spending_alerts', 'saving_tips', 'investment_insights', 'action_items'].map(key => {
              const Icon = iconMap[key];
              const items = insights[key] || [];
              if (items.length === 0) return null;
              return (
                <div key={key} className="card">
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: '1rem', fontWeight: 700 }}><Icon size={18} style={{ color: colorMap[key] }} />{labelMap[key]}</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {items.map((item, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        <span style={{ color: colorMap[key], fontWeight: 700 }}>•</span>
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

      {!insights && !loading && (
        <div className="card empty-state"><Brain size={48} /><h3>No insights yet</h3><p>Add some transactions and click Refresh</p></div>
      )}

      <style jsx>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
