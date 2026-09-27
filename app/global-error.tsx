'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global application error', {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <html lang="vi">
      <body style={{ margin: 0, fontFamily: 'Arial, sans-serif', background: '#f6f8f7', color: '#17211f' }}>
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
          <section style={{ width: '100%', maxWidth: 620, background: '#fff', border: '1px solid #dce3e0', borderRadius: 16, padding: 32 }}>
            <p style={{ marginTop: 0, fontSize: 12, fontWeight: 700, letterSpacing: '.12em', color: '#11655d' }}>
              JFT PRACTICE
            </p>
            <h1 style={{ marginBottom: 12 }}>Hệ thống tạm thời gặp lỗi</h1>
            <p style={{ lineHeight: 1.7, color: '#687571' }}>
              Dữ liệu bài thi chưa được xác nhận là đã thay đổi. Hãy thử tải lại màn hình này.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{ marginTop: 16, border: 0, borderRadius: 6, padding: '12px 18px', fontWeight: 700, background: '#11655d', color: '#fff', cursor: 'pointer' }}
            >
              Thử lại
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
