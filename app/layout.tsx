import './globals.css';
import './rebuild.css';

export const metadata = {
  title: {
    default: 'JFT Practice — Luyện JFT theo trải nghiệm CBT',
    template: '%s · JFT Practice',
  },
  description: 'Nền tảng luyện JFT-Basic không chính thức với 3.000 câu hỏi, bốn phần kỹ năng, audio nghe hiểu và trải nghiệm CBT.',
  applicationName: 'JFT Practice',
  metadataBase: new URL('https://jft-simulator.vercel.app'),
  robots: { index: true, follow: true },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0d514b',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
