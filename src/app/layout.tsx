import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI 漫剧系统',
  description: 'AI Comic Drama Generation Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen bg-white text-ink">
        {children}
      </body>
    </html>
  );
}
