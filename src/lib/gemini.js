import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY);

export async function getFinancialInsight(prompt) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Gemini API error:', error);
    throw error;
  }
}

export function buildInsightPrompt(data) {
  const { 
    totalIncome, 
    totalExpenses, 
    savingsRate,
    topCategories,
    cycleLabel,
    currency = '₹'
  } = data;

  return `You are a personal finance advisor analyzing monthly data for cycle "${cycleLabel}".

Data:
- Total Income: ${currency}${totalIncome}
- Total Expenses: ${currency}${totalExpenses}
- Savings Rate: ${savingsRate}%
- Top spending categories: ${topCategories?.map(c => `${c.name}: ${currency}${c.amount}`).join(', ')}

Give a brief 2-3 sentence financial insight. Be specific with numbers. Mention the top spending category and whether the savings rate is healthy (target: 30%+). Keep tone friendly and actionable. Do NOT use markdown.`;
}

export function buildDetailedReportPrompt(data) {
  const {
    totalIncome,
    totalExpenses,
    categories,
    investments,
    emergencyFund,
    cycleLabel,
    currency = '₹'
  } = data;

  return `You are a personal finance advisor. Generate a brief monthly financial health report for cycle "${cycleLabel}".

Income: ${currency}${totalIncome}
Expenses: ${currency}${totalExpenses}
Savings: ${currency}${totalIncome - totalExpenses}
Savings Rate: ${((totalIncome - totalExpenses) / totalIncome * 100).toFixed(1)}%

Spending by category:
${categories?.map(c => `- ${c.name}: ${currency}${c.amount}`).join('\n')}

Investments total: ${currency}${investments || 0}
Emergency Fund: ${currency}${emergencyFund || 0}

Generate these sections (keep each brief, 2-3 sentences max):
1. Overall Health Score (give a score out of 10)
2. Spending Analysis (highlight concerning categories)
3. Savings Assessment
4. One actionable tip

Keep tone professional but friendly. Use plain text, NO markdown formatting.`;
}
