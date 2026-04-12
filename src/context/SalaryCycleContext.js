'use client';

import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { getCurrentCycle, getAvailableMonths, getCycleForDate } from '@/lib/salaryCycle';

const SalaryCycleContext = createContext({});

export function SalaryCycleProvider({ children }) {
  const { userProfile } = useAuth();
  const salaryCycleDay = userProfile?.salaryCycleDay || 28;

  const currentCycle = useMemo(() => getCurrentCycle(salaryCycleDay), [salaryCycleDay]);
  const [selectedCycle, setSelectedCycle] = useState(null);

  useEffect(() => {
    setSelectedCycle(currentCycle);
  }, [currentCycle]);

  const availableCycles = useMemo(() => getAvailableMonths(salaryCycleDay), [salaryCycleDay]);

  const getCycleFor = (date) => getCycleForDate(date, salaryCycleDay);

  const isCurrentCycle = selectedCycle?.id === currentCycle?.id;

  return (
    <SalaryCycleContext.Provider value={{
      salaryCycleDay,
      currentCycle,
      selectedCycle,
      setSelectedCycle,
      availableCycles,
      getCycleFor,
      isCurrentCycle,
    }}>
      {children}
    </SalaryCycleContext.Provider>
  );
}

export function useSalaryCycle() {
  const context = useContext(SalaryCycleContext);
  if (!context) {
    throw new Error('useSalaryCycle must be used within SalaryCycleProvider');
  }
  return context;
}
