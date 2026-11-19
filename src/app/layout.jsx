import localFont from 'next/font/local';
import { salon } from '@/config/salon.js';
import './globals.css';

// Fonts are stored in the project (src/app/fonts), so builds never depend on Google Fonts
const fraunces = localFont({
  src: [
    { path: './fonts/fraunces-latin-full-normal.woff2', style: 'normal' },
    { path: './fonts/fraunces-latin-full-italic.woff2', style: 'italic' },
  ],
  weight: '100 900',
  variable: '--font-fraunces',
  display: 'swap',
});
const hanken = localFont({
  src: './fonts/hanken-grotesk-latin-wght-normal.woff2',
  weight: '100 900',
  variable: '--font-hanken',
  display: 'swap',
});

export const metadata = {
  title: `${salon.name} | Hair and beauty salon in Lekki`,
  description: salon.intro,
};

export const viewport = { themeColor: '#F3EEE6' };

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${hanken.variable}`}>
      <body>{children}</body>
    </html>
  );
}
