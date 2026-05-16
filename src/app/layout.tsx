import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import { ThemeProvider } from '@/lib/themes/ThemeProvider';

export default function RootLayout(props: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>TeleCloud - Multi-Cloud Manager &amp; S3 Storage</title>
        <meta name="description" content="Free unlimited S3-compatible storage with Telegram backend." />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased" style={{ fontFamily: 'Inter, sans-serif' }}>
        <ThemeProvider>
          <AuthProvider>
            {props.children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
