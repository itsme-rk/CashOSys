/**
 * AI Service — Tries Gemini first, falls back to Groq (free)
 * This ensures AI features always work even when one API hits rate limits.
 */

async function callGemini(prompt) {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') throw new Error('No Gemini key');
  
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

async function callGroq(prompt) {
  const apiKey = process.env.NEXT_PUBLIC_GROQ_API_KEY;
  if (!apiKey) throw new Error('No Groq key');
  
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'You are a financial analysis assistant. Always respond in valid JSON when asked. Be concise.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 2000,
      temperature: 0.3,
    }),
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Groq API error: ${res.status}`);
  }
  
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * Call AI with automatic fallback: Gemini → Groq
 * @param {string} prompt 
 * @returns {string} Raw text response
 */
export async function callAI(prompt) {
  // Try Gemini first
  try {
    return await callGemini(prompt);
  } catch (geminiErr) {
    console.warn('Gemini failed, trying Groq:', geminiErr.message);
  }
  
  // Fallback to Groq
  try {
    return await callGroq(prompt);
  } catch (groqErr) {
    console.error('Both AI providers failed:', groqErr.message);
    throw new Error('AI service unavailable. Both Gemini and Groq failed. Try again later.');
  }
}

/**
 * Parse JSON from AI response (handles markdown code blocks)
 */
export function parseAIJson(text) {
  // Try extracting from ```json ... ``` blocks first
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const rawJson = codeBlockMatch ? codeBlockMatch[1].trim() : text;
  const jsonMatch = rawJson.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.warn('JSON parse failed:', e.message);
    }
  }
  return null;
}

/**
 * Fetch real-time stock quote from Alpha Vantage
 */
export async function getStockQuote(symbol) {
  const apiKey = process.env.NEXT_PUBLIC_ALPHA_VANTAGE_KEY;
  if (!apiKey) return null;
  
  try {
    const res = await fetch(
      `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`
    );
    const data = await res.json();
    const q = data['Global Quote'];
    if (!q || !q['05. price']) return null;
    
    return {
      symbol: q['01. symbol'],
      price: parseFloat(q['05. price']),
      change: parseFloat(q['09. change']),
      changePercent: q['10. change percent'],
      high: parseFloat(q['03. high']),
      low: parseFloat(q['04. low']),
      volume: parseInt(q['06. volume']),
      lastTraded: q['07. latest trading day'],
    };
  } catch (err) {
    console.error('Alpha Vantage error:', err);
    return null;
  }
}
