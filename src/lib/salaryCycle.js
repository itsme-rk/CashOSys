/**
 * Salary Cycle System (Dynamic + Fallback)
 * 
 * If income dates are provided, cycles span from one income date to the next.
 * Otherwise, falls back to the static salaryCycleDay.
 */

// Format "YYYY-MM-DD"
function toISODateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Generate a strict fallback salary cycle
 */
export function generateSalaryCycle(salaryCycleDay, month, year) {
  const startDate = new Date(year, month, salaryCycleDay);
  
  // End date is the day before salary day of next month
  let endMonth = month + 1;
  let endYear = year;
  if (endMonth > 11) {
    endMonth = 0;
    endYear += 1;
  }
  const endDate = new Date(endYear, endMonth, salaryCycleDay - 1);
  
  const label = startDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  const id = `${year}-${String(month + 1).padStart(2, '0')}`;
  
  return { id, startDate: startDate.toISOString(), endDate: endDate.toISOString(), label, month: month + 1, year };
}

/**
 * Get cycle for a date using exact income date boundaries if available
 * @param {Date|string} date 
 * @param {number} salaryCycleDay 
 * @param {Array<string>} incomeDates - Sorted array of exact Date strings (ISO format) of primary income
 */
export function getCycleForDate(date, salaryCycleDay, incomeDates = []) {
  const d = date instanceof Date ? date : new Date(date);
  
  if (incomeDates && incomeDates.length > 0) {
    // incomeDates are assumed sorted earliest to latest
    // Find the latest income date that is <= d
    let cycleStartDate = null;
    let nextIncomeDate = null;
    
    // Normalize target date to midnight local
    const targetTime = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

    for (let i = 0; i < incomeDates.length; i++) {
        const idate = new Date(incomeDates[i]);
        const itime = new Date(idate.getFullYear(), idate.getMonth(), idate.getDate()).getTime();
        
        if (itime <= targetTime) {
            cycleStartDate = idate;
        } else {
            nextIncomeDate = idate;
            break;
        }
    }

    if (cycleStartDate) {
      // We found an exact matching dynamic cycle
      // If no next income, end date is roughly +30 days fallback
      let endDate;
      if (nextIncomeDate) {
        endDate = new Date(nextIncomeDate.getFullYear(), nextIncomeDate.getMonth(), nextIncomeDate.getDate() - 1);
      } else {
        endDate = new Date(cycleStartDate);
        endDate.setMonth(endDate.getMonth() + 1);
        endDate.setDate(endDate.getDate() - 1);
      }
      
      const label = cycleStartDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      const id = `${cycleStartDate.getFullYear()}-${String(cycleStartDate.getMonth() + 1).padStart(2, '0')}`;
      
      return { id, startDate: cycleStartDate.toISOString(), endDate: endDate.toISOString(), label, isDynamic: true };
    }
  }

  // Fallback to purely static layout if outside bounds or no dynamic dates provided
  const day = d.getDate();
  let month = d.getMonth();
  let year = d.getFullYear();
  
  if (day < salaryCycleDay) {
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
  }
  return generateSalaryCycle(salaryCycleDay, month, year);
}

export function getCurrentCycle(salaryCycleDay) {
  return getCycleForDate(new Date(), salaryCycleDay);
}

export function getAvailableMonths(salaryCycleDay, incomeDates = []) {
  const cyclesMap = new Map();
  // 1. Generate fallback last 12 months cycles
  const now = new Date();
  for (let i = -12; i <= 2; i++) {
    let m = now.getMonth() + i;
    let y = now.getFullYear();
    while (m < 0) { m += 12; y -= 1; }
    while (m > 11) { m -= 12; y += 1; }
    const c = generateSalaryCycle(salaryCycleDay, m, y);
    cyclesMap.set(c.id, c);
  }
  
  // 2. Override with known dynamic cycles if they map to these months
  if (incomeDates && incomeDates.length > 0) {
    for (let i = 0; i < incomeDates.length; i++) {
       const cd = getCycleForDate(incomeDates[i], salaryCycleDay, incomeDates);
       cyclesMap.set(cd.id, cd); // Override label and exact dates for the month
    }
  }
  
  // Sort by id exactly like "YYYY-MM"
  const sorted = Array.from(cyclesMap.values()).sort((a,b) => a.id.localeCompare(b.id));
  return sorted;
}
