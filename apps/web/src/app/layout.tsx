import type { Metadata } from 'next';
import '../styles/baari.css';

export const metadata: Metadata = {
  title: 'Baari — Your turn.',
  description: 'WhatsApp-native appointment booking for salons and wellness businesses.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: 'var(--bg)', color: 'var(--fg)' }}>
        {children}
      </body>
    </html>
  );
}
