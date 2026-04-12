'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import OnboardingWizard from '../Onboarding';
import styles from './AppShell.module.css';
import { useEffect, useState } from 'react';

const PUBLIC_ROUTES = ['/auth'];

export default function AppShell({ children }) {
  const { isAuthenticated, loading, userProfile } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated && !isPublicRoute) {
        router.push('/auth');
      }
      if (isAuthenticated && (pathname === '/' || pathname === '/auth')) {
        router.push('/dashboard');
      }
    }
  }, [isAuthenticated, loading, pathname, router, isPublicRoute]);

  // Show onboarding for new users
  useEffect(() => {
    if (isAuthenticated && userProfile && !userProfile.onboardingComplete) {
      setShowOnboarding(true);
    }
  }, [isAuthenticated, userProfile]);

  // Loading state
  if (loading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingLogo}>
          <span>₹</span>
        </div>
        <div className={styles.loadingText}>CashOSys</div>
        <div className={styles.loadingBar}>
          <div className={styles.loadingBarFill} />
        </div>
      </div>
    );
  }

  // Auth pages - no shell
  if (isPublicRoute || !isAuthenticated) {
    return <>{children}</>;
  }

  // App shell with sidebar + bottom nav
  return (
    <div className={styles.appShell}>
      <Sidebar />
      <main className={styles.mainContent}>
        <div className={styles.pageContent}>
          {children}
        </div>
      </main>
      <BottomNav />
      {showOnboarding && (
        <OnboardingWizard onComplete={() => setShowOnboarding(false)} />
      )}
    </div>
  );
}
