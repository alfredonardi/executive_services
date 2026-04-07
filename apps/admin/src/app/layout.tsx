import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Executive Concierge SP — Admin',
  description: 'Concierge team operations panel',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          backgroundColor: '#0A0A0A',
          color: '#E8E5E0',
        }}
      >
        {children}
      </body>
    </html>
  );
}
