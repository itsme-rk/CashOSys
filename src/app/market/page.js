'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { subscribeInvestments, subscribeWatchlist } from '@/lib/firestore';
import { formatCurrency } from '@/lib/constants';
import { callAI, parseAIJson } from '@/lib/ai';
import { Brain, TrendingUp, TrendingDown, Shield, AlertTriangle, Sparkles, RefreshCw, Newspaper, Target, Search } from 'lucide-react';

export default function MarketIntelligencePage() {
  const { user } = useAuth();
  const [investments, setInvestments] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('portfolio'); // 'portfolio' | 'discover' | 'news'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const u1 = subscribeInvestments(user.uid, setInvestments);
    const u2 = subscribeWatchlist(user.uid, setWatchlist);
    return () => { u1(); u2(); };
  }, [user]);

  const analyzePortfolio = async () => {
    setLoading(true);
    setError('');
    try {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
        setAnalysis(getOfflineAnalysis());
        setLoading(false);
        return;
      }

      const holdings = investments.map(i => `- ${i.bucket}: ${i.instrumentName || i.description} (₹${i.investedAmount}, ticker: ${i.ticker || 'N/A'})`).join('\n');
      const watchlistItems = watchlist.map(w => `- ${w.name} (${w.ticker}, type: ${w.type})`).join('\n');

      const prompt = `You are an expert Indian stock market analyst and investment advisor. Analyze this portfolio and provide actionable advice.

CURRENT HOLDINGS:
${holdings || 'No holdings yet'}

WATCHLIST:
${watchlistItems || 'Empty watchlist'}

Today's date: ${new Date().toLocaleDateString('en-IN')}

Provide analysis in this exact JSON format:
{
  "portfolio_health": {
    "score": 7,
    "summary": "Brief portfolio health assessment",
    "risks": ["risk1", "risk2"],
    "strengths": ["strength1", "strength2"]
  },
  "stock_analysis": [
    {
      "name": "Stock name",
      "ticker": "TICKER.NS",
      "action": "HOLD/BUY MORE/SELL/WATCH",
      "reason": "Why this action",
      "risk_level": "low/medium/high"
    }
  ],
  "recommendations": [
    {
      "name": "Recommended stock/ETF name",
      "ticker": "TICKER.NS",
      "type": "stock/etf/mutual-fund",
      "reason": "Why to consider",
      "entry_strategy": "When/how to enter"
    }
  ],
  "market_outlook": "Brief India market outlook",
  "action_items": ["actionable step 1", "step 2"]
}

Focus on Indian markets (NSE/BSE). Be specific about sectors, entry points, and reasoning. Consider diversification, risk management, and long-term growth.`;

      try {
        const text = await callAI(prompt);
        const parsed = parseAIJson(text);
        if (parsed) {
          setAnalysis(parsed);
        } else {
          setAnalysis(getOfflineAnalysis());
        }
      } catch (err) {
        console.error('Market analysis error:', err);
        setError(err.message || 'Failed to analyze portfolio');
        setAnalysis(getOfflineAnalysis());
      }
    } finally {
      setLoading(false);
    }
  };

  const searchStock = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setSearchResult(null);
    try {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
        setSearchResult({
          name: searchQuery,
          summary: 'Configure your Gemini API key to get AI-powered stock analysis.',
          recommendation: 'N/A',
          risk_level: 'N/A',
        });
        setSearchLoading(false);
        return;
      }

      try {
        const text = await callAI(
          `You are an Indian stock market expert. Give a brief investment analysis for "${searchQuery}" (Indian market context). 
Include: what is it, current sentiment, whether to invest, risk level, and a brief outlook. 
Reply in JSON: {"name": "...", "ticker": "...", "type": "stock/etf/mf", "summary": "...", "recommendation": "BUY/HOLD/AVOID", "risk_level": "low/medium/high", "key_points": ["point1", "point2"], "outlook": "..."}`
        );
        const parsed = parseAIJson(text);
        if (parsed) {
          setSearchResult(parsed);
        } else {
          setError('Could not interpret AI response');
        }
      } catch (err) {
        setError(err.message);
      }
    } finally {
      setSearchLoading(false);
    }
  };

  function getOfflineAnalysis() {
    const totalInvested = investments.reduce((s, i) => s + (i.investedAmount || 0), 0);
    const buckets = [...new Set(investments.map(i => i.bucket))];
    return {
      portfolio_health: {
        score: buckets.length >= 3 ? 7 : buckets.length >= 2 ? 5 : 3,
        summary: `Portfolio has ${investments.length} holdings across ${buckets.length} buckets totaling ${formatCurrency(totalInvested)}.`,
        risks: buckets.length < 3 ? ['Low diversification — consider adding more asset classes'] : ['Market risk on equity holdings'],
        strengths: investments.length > 0 ? ['Active portfolio management'] : ['Clean slate to start investing strategically'],
      },
      stock_analysis: investments.slice(0, 5).map(i => ({
        name: i.instrumentName || i.description,
        ticker: i.ticker || 'N/A',
        action: 'HOLD',
        reason: 'Configure Gemini API for personalized recommendations',
        risk_level: 'medium',
      })),
      recommendations: [
        { name: 'Nifty 50 ETF', ticker: 'NIFTYBEES.NS', type: 'etf', reason: 'Core index exposure for long-term growth', entry_strategy: 'SIP monthly' },
        { name: 'Gold ETF', ticker: 'GOLDBEES.NS', type: 'etf', reason: 'Hedge against market volatility', entry_strategy: 'Allocate 10-15% of portfolio' },
      ],
      market_outlook: 'Configure Gemini API key for real-time market outlook analysis.',
      action_items: ['Set up API key for AI analysis', 'Review portfolio diversification', 'Set up SIP for index ETFs'],
    };
  }

  const riskColors = { low: 'var(--accent-green)', medium: 'var(--accent-gold)', high: 'var(--error)' };
  const actionColors = { 'BUY': 'var(--accent-green)', 'BUY MORE': 'var(--accent-green)', 'HOLD': 'var(--accent-gold)', 'SELL': 'var(--error)', 'WATCH': 'var(--info)', 'AVOID': 'var(--error)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Brain size={28} style={{ color: 'var(--accent-gold)' }} /> Market Intelligence
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: 4 }}>AI-powered portfolio analysis & stock recommendations</p>
        </div>
        <button className="btn btn-primary" onClick={analyzePortfolio} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} /> {loading ? 'Analyzing...' : 'Analyze Portfolio'}
        </button>
      </div>

      {error && <div style={{ background: 'var(--error-bg)', color: 'var(--error)', padding: 16, borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>{error}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
        {[{ id: 'portfolio', label: '📊 Portfolio Analysis' }, { id: 'discover', label: '🔍 Stock Research' }, { id: 'news', label: '📰 Recommendations' }].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            flex: 1, padding: '10px 16px', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '0.8125rem',
            background: activeTab === tab.id ? 'var(--bg-primary)' : 'transparent',
            color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
            border: activeTab === tab.id ? '1px solid var(--border-color)' : '1px solid transparent',
            cursor: 'pointer', transition: 'all 0.2s',
          }}>{tab.label}</button>
        ))}
      </div>

      {/* Portfolio Analysis Tab */}
      {activeTab === 'portfolio' && analysis && (
        <>
          {/* Health Score */}
          <div className="card card-glow-gold" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', fontWeight: 900, color: 'var(--accent-gold)', marginBottom: 8 }}>
              {analysis.portfolio_health?.score || 0}<span style={{ fontSize: '1.5rem', color: 'var(--text-tertiary)' }}>/10</span>
            </div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Portfolio Health Score</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.6 }}>{analysis.portfolio_health?.summary}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div className="card">
              <h3 style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700, marginBottom: 16, color: 'var(--accent-green)' }}><Shield size={18} /> Strengths</h3>
              {(analysis.portfolio_health?.strengths || []).map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  <span style={{ color: 'var(--accent-green)' }}>✓</span> {s}
                </div>
              ))}
            </div>
            <div className="card">
              <h3 style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700, marginBottom: 16, color: 'var(--error)' }}><AlertTriangle size={18} /> Risks</h3>
              {(analysis.portfolio_health?.risks || []).map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  <span style={{ color: 'var(--error)' }}>⚠</span> {r}
                </div>
              ))}
            </div>
          </div>

          {/* Stock-by-stock analysis */}
          {analysis.stock_analysis?.length > 0 && (
            <div className="card">
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>Holdings Analysis</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {analysis.stock_analysis.map((stock, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 12, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700 }}>{stock.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{stock.ticker}</div>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: 300 }}>{stock.reason}</div>
                    <span className="badge" style={{ background: `${riskColors[stock.risk_level]}20`, color: riskColors[stock.risk_level] }}>{stock.risk_level} risk</span>
                    <span className="badge" style={{ background: `${actionColors[stock.action]}20`, color: actionColors[stock.action], fontWeight: 800 }}>{stock.action}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Market Outlook */}
          {analysis.market_outlook && (
            <div className="card">
              <h3 style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700, marginBottom: 12 }}><Newspaper size={18} style={{ color: 'var(--text-tertiary)' }} /> Market Outlook</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '0.9375rem' }}>{analysis.market_outlook}</p>
            </div>
          )}
        </>
      )}

      {/* Stock Research Tab */}
      {activeTab === 'discover' && (
        <>
          <div className="card">
            <h3 style={{ fontWeight: 700, marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}><Search size={18} /> Research a Stock / ETF / Mutual Fund</h3>
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="e.g., Nifty BeES, Adani Power, SBI Gold ETF..."
                style={{ flex: 1 }}
                onKeyDown={e => e.key === 'Enter' && searchStock()}
              />
              <button className="btn btn-primary" onClick={searchStock} disabled={searchLoading}>
                {searchLoading ? 'Analyzing...' : 'Research'}
              </button>
            </div>
          </div>

          {searchResult && (
            <div className="card" style={{ borderColor: `${actionColors[searchResult.recommendation]}30` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontWeight: 800, fontSize: '1.25rem' }}>{searchResult.name}</h3>
                  {searchResult.ticker && <div style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>{searchResult.ticker} • {searchResult.type}</div>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span className="badge" style={{ background: `${riskColors[searchResult.risk_level]}20`, color: riskColors[searchResult.risk_level] }}>{searchResult.risk_level} risk</span>
                  <span className="badge" style={{ background: `${actionColors[searchResult.recommendation]}20`, color: actionColors[searchResult.recommendation], fontWeight: 800, fontSize: '0.875rem' }}>{searchResult.recommendation}</span>
                </div>
              </div>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>{searchResult.summary}</p>
              {searchResult.key_points?.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.8125rem', marginBottom: 8, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Key Points</div>
                  {searchResult.key_points.map((p, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      <Sparkles size={14} style={{ color: 'var(--accent-gold)', flexShrink: 0, marginTop: 3 }} /> {p}
                    </div>
                  ))}
                </div>
              )}
              {searchResult.outlook && <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Outlook: {searchResult.outlook}</p>}
            </div>
          )}
        </>
      )}

      {/* Recommendations Tab */}
      {activeTab === 'news' && analysis && (
        <>
          {analysis.recommendations?.length > 0 && (
            <div className="card">
              <h3 style={{ fontWeight: 700, marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}><Target size={18} style={{ color: 'var(--accent-green)' }} /> AI Recommendations</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {analysis.recommendations.map((rec, i) => (
                  <div key={i} style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '1.0625rem' }}>{rec.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{rec.ticker} • {rec.type}</div>
                      </div>
                      <span className="badge badge-green">Recommended</span>
                    </div>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 8 }}>{rec.reason}</p>
                    {rec.entry_strategy && (
                      <div style={{ fontSize: '0.8125rem', color: 'var(--accent-gold)', fontWeight: 600 }}>
                        📍 Entry Strategy: {rec.entry_strategy}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {analysis.action_items?.length > 0 && (
            <div className="card">
              <h3 style={{ fontWeight: 700, marginBottom: 16 }}>Next Steps</h3>
              {analysis.action_items.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 10, fontSize: '0.875rem' }}>
                  <div style={{ width: 24, height: 24, borderRadius: 'var(--radius-full)', background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.6875rem', color: 'var(--accent-green)', flexShrink: 0 }}>{i + 1}</div>
                  <span style={{ color: 'var(--text-secondary)' }}>{item}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {!analysis && !loading && (
        <div className="card empty-state">
          <Brain size={48} style={{ color: 'var(--accent-gold)' }} />
          <h3>Click "Analyze Portfolio" to get started</h3>
          <p>AI will review your holdings, analyze risks, and recommend investments</p>
        </div>
      )}

      <style jsx>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
