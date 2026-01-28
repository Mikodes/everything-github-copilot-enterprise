import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { MainLayout } from '@/components/layout/main-layout';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'EGCE Dashboard - Memory Bank Management',
  description:
    'Web Dashboard for Everything GitHub Copilot Enterprise - Visualize and manage your team Memory Bank, ADRs, and knowledge base.',
  keywords: [
    'GitHub Copilot',
    'Enterprise',
    'Memory Bank',
    'ADR',
    'Architecture Decision Records',
    'Team Knowledge',
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          <MainLayout>{children}</MainLayout>
        </Providers>
      </body>
    </html>
  );
}
