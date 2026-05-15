import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import { ThemeProvider } from '@/lib/themes/ThemeProvider';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'TeleCloud - Multi-Cloud Manager & S3 Storage',
  description: 'Free unlimited S3-compatible storage with Telegram backend. Manage Google Drive, Dropbox, S3 and more in one place. rclone-compatible transfers.',
  keywords: ['S3', 'storage', 'Telegram', 'cloud storage', 'multicloud', 'rclone', 'file transfer', 'Google Drive', 'Dropbox'],
  authors: [{ name: 'TeleCloud' }],
  openGraph: {
    title: 'TeleCloud - Multi-Cloud Storage Manager',
    description: 'Free unlimited storage + manage all your clouds in one place. Like multcloud.com but self-hosted.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
