import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { SalaryCycleProvider } from '@/context/SalaryCycleContext';
import AppShell from '@/components/layout/AppShell';
import Script from 'next/script';

export const metadata = {
  title: 'CashOSys — Personal Finance Operating System',
  description: 'Track income, expenses, investments, emergency funds, and loans. Salary-cycle-driven personal finance app with AI insights.',
  keywords: 'finance, budget, expense tracker, investment, salary cycle, personal finance',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'CashOSys',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#00E676',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <SalaryCycleProvider>
              <AppShell>
                {children}
              </AppShell>
            </SalaryCycleProvider>
          </AuthProvider>
        </ThemeProvider>
        {/* Register service worker */}
        <Script id="sw-register" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js').catch(function(err) {
                  console.log('SW registration failed:', err);
                });
              });
            }
          `}
        </Script>
      </body>
    </html>
  );
}
