import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Library — My Dark Romantasy',
  description: 'Top-performing posts, ranked and ready to riff on.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
