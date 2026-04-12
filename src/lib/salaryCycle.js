/**
 * Salary Cycle System
 * 
 * The salary cycle is based on the user's salary credit day.
 * Corporate salary depends on the last working day of the month
 * (not a public holiday or bank holiday).
 * 
 * Cycle: This month's salary → Next month's salary
 * Example: If salary comes on 28th March, cycle is 28 Mar → 27 Apr
 */

/**
 * Generate salary cycle for a given month/year
 * @param {number} salaryCycleDay - Day of month salary is credited (e.g., 28)
 * @param {number} month - Month (0-11)
 * @param {number} year - Full year
 * @returns {Object} { id, startDate, endDate, label }
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
  
  // Label: "Mar-2026"
  const label = startDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  const id = `${year}-${String(month + 1).padStart(2, '0')}`;
  
  return {
    id,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    label,
    month: month + 1,
    year,
  };
}

/**
 * Generate all salary cycles between two dates
 */
export function generateCyclesRange(salaryCycleDay, startYear, startMonth, endYear, endMonth) {
  const cycles = [];
  let y = startYear;
  let m = startMonth;
  
  while (y < endYear || (y === endYear && m <= endMonth)) {
    cycles.push(generateSalaryCycle(salaryCycleDay, m, y));
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
  
  return cycles;
}

/**
 * Determine which salary cycle a given date belongs to
 * @param {Date|string} date - The date to check
 * @param {number} salaryCycleDay - Day of month salary is credited
 * @returns {Object} { id, label, month, year }
 */
export function getCycleForDate(date, salaryCycleDay) {
  const d = date instanceof Date ? date : new Date(date);
  const day = d.getDate();
  let month = d.getMonth();
  let year = d.getFullYear();
  
  // If the day is before salary day, it belongs to previous month's cycle
  if (day < salaryCycleDay) {
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
  }
  
  return generateSalaryCycle(salaryCycleDay, month, year);
}

/**
 * Get the current salary cycle
 */
export function getCurrentCycle(salaryCycleDay) {
  return getCycleForDate(new Date(), salaryCycleDay);
}

/**
 * Get label for a cycle (e.g., "Mar 2026")
 */
export function getCycleLabel(month, year) {
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/**
 * Get list of months for dropdown (last 12 months + current + next 2)
 */
export function getAvailableMonths(salaryCycleDay) {
  const now = new Date();
  const cycles = [];
  
  // Last 12 months
  for (let i = -12; i <= 2; i++) {
    let m = now.getMonth() + i;
    let y = now.getFullYear();
    while (m < 0) { m += 12; y -= 1; }
    while (m > 11) { m -= 12; y += 1; }
    cycles.push(generateSalaryCycle(salaryCycleDay, m, y));
  }
  
  return cycles;
}
