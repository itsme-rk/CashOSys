'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Receipt,
  PlusCircle,
  TrendingUp,
  User,
  Wallet,
  Target,
  CreditCard,
  Users,
  Shield,
  Brain,
  BarChart3,
  Eye,
  Settings,
  LogOut,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useState } from 'react';
import styles from './Sidebar.module.css';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/expenses', icon: Receipt, label: 'Expenses' },
  { href: '/income', icon: Wallet, label: 'Income' },
  { href: '/investments', icon: TrendingUp, label: 'Investments' },
  { href: '/investments/watchlist', icon: Eye, label: 'Watchlist' },
  { href: '/emergency-fund', icon: Shield, label: 'Emergency Fund' },
  { href: '/goals', icon: Target, label: 'Goals' },
  { href: '/loans', icon: CreditCard, label: 'Loans' },
  { href: '/lending', icon: Users, label: 'Lending' },
  { href: '/insights', icon: Brain, label: 'AI Insights' },
  { href: '/market', icon: BarChart3, label: 'Market Intel' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { signOut, user, userProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
      {/* Logo */}
      <div className={styles.logoSection}>
        <div className={styles.logoMark}>
          <span className={styles.logoIcon}>₹</span>
        </div>
        {!collapsed && (
          <div className={styles.logoText}>
            <h1>CashOSys</h1>
            <span>Finance OS</span>
          </div>
        )}
        <button
          className={styles.collapseBtn}
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Quick Add Button */}
      <Link href="/add" className={styles.addBtn}>
        <PlusCircle size={20} />
        {!collapsed && <span>Add Transaction</span>}
      </Link>

      {/* Navigation */}
      <nav className={styles.nav}>
        {navItems.map((item) => {
          // Exact match for most routes, but allow nested matching for specific parent routes
          const isActive = pathname === item.href || 
            (item.href !== '/investments' && pathname?.startsWith(item.href + '/'));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${isActive ? styles.active : ''}`}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={20} />
              {!collapsed && <span>{item.label}</span>}
              {isActive && <div className={styles.activeIndicator} />}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className={styles.bottomSection}>
        <button className={styles.themeBtn} onClick={toggleTheme} title="Toggle theme">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          {!collapsed && <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>

        <div className={styles.userSection}>
          <div className={styles.userAvatar} style={{ overflow: 'hidden' }}>
            {userProfile?.photoURL ? (
              <img src={userProfile.photoURL} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'
            )}
          </div>
          {!collapsed && (
            <div className={styles.userInfo}>
              <span className={styles.userName}>{userProfile?.displayName || user?.displayName || 'User'}</span>
              <span className={styles.userEmail}>{user?.email}</span>
            </div>
          )}
          <button className={styles.logoutBtn} onClick={signOut} title="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
