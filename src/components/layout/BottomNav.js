'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Receipt, PlusCircle, TrendingUp, User } from 'lucide-react';
import styles from './BottomNav.module.css';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/expenses', icon: Receipt, label: 'Expenses' },
  { href: '/add', icon: PlusCircle, label: 'Add', isSpecial: true },
  { href: '/investments', icon: TrendingUp, label: 'Invest' },
  { href: '/settings', icon: User, label: 'Profile' },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.bottomNav}>
      {navItems.map((item) => {
        const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.navItem} ${isActive ? styles.active : ''} ${item.isSpecial ? styles.special : ''}`}
          >
            {item.isSpecial ? (
              <div className={styles.addButton}>
                <Icon size={24} />
              </div>
            ) : (
              <>
                <Icon size={20} />
                <span>{item.label}</span>
                {isActive && <div className={styles.dot} />}
              </>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
