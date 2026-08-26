import Link from 'next/link';
import type { ReactNode } from 'react';

export default function AuthShell({ children }: { children: ReactNode }) {
  return <main className="auth-shell">
    <section className="auth-intro" aria-label="Giới thiệu JFT Simulator">
      <Link href="/" className="auth-product-brand"><span aria-hidden="true">J</span><b>JFT Simulator</b></Link>
      <div><span className="eyebrow">JFT-BASIC PRACTICE</span><p className="auth-product-title">Thi thử JFT theo<br />trải nghiệm CBT</p><p>Một không gian tập trung để bạn luyện tập và theo dõi tiến độ.</p><ul><li><span aria-hidden="true">✓</span>Lưu tiến độ</li><li><span aria-hidden="true">✓</span>Xem kết quả</li><li><span aria-hidden="true">✓</span>Kiểm tra lại câu sai</li></ul></div>
      <p className="auth-trust">Công cụ luyện tập JFT-Basic không chính thức.</p>
    </section>
    <section className="auth-form-panel"><div className="auth-mobile-brand"><Link href="/" className="auth-product-brand"><span aria-hidden="true">J</span><b>JFT Simulator</b></Link><p>Thi thử JFT theo trải nghiệm CBT</p></div><div className="auth-card">{children}</div></section>
  </main>;
}
