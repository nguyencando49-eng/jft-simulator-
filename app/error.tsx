'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error', {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <main className="shell">
      <section className="stage-card card">
        <span className="step">JFT PRACTICE</span>
        <h1>Đã xảy ra lỗi</h1>
        <p>
          Hệ thống chưa thể hoàn tất thao tác này. Bạn có thể thử lại mà không cần
          tải lại toàn bộ bài thi.
        </p>
        <div className="ui-alert danger">
          Nếu lỗi lặp lại, hãy quay về trang chính rồi mở lại bài thi từ lịch sử.
        </div>
        <div className="stage-actions">
          <Link className="secondary" href="/">
            Về trang chính
          </Link>
          <button className="primary" type="button" onClick={reset}>
            Thử lại
          </button>
        </div>
      </section>
    </main>
  );
}
