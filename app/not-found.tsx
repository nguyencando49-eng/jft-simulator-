import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="shell">
      <section className="stage-card card">
        <span className="step">404</span>
        <h1>Không tìm thấy trang</h1>
        <p>
          Đường dẫn này không tồn tại hoặc nội dung đã được chuyển sang vị trí khác.
        </p>
        <div className="stage-actions">
          <span />
          <Link className="primary" href="/">
            Về trang chính
          </Link>
        </div>
      </section>
    </main>
  );
}
