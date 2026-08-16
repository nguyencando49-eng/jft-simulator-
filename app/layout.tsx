import './globals.css';

export const metadata = {
  title: 'JFT Simulator',
  description: 'Unofficial JFT-Basic CBT practice simulator',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
