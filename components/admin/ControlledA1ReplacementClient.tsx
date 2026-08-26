'use client';

import { useEffect, useState } from 'react';

type Preview = {
  releaseVersion: string;
  existing: number;
  willArchive: number;
  alreadyArchived: number;
  willUpsert: number;
  byLevel: Record<string, number>;
  listeningAudio: number;
};

export default function ControlledA1ReplacementClient() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const response = await fetch('/api/v1/admin/controlled-a1-replacement', { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Không thể tải bản xem trước.');
    setPreview(payload.preview);
  }

  useEffect(() => {
    void load().catch((reason) => setError(reason instanceof Error ? reason.message : 'Không thể tải dữ liệu.'));
  }, []);

  async function mutate(action: 'apply' | 'rollback') {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/v1/admin/controlled-a1-replacement', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action,
          confirmation: action === 'apply' ? 'ARCHIVE_2100_IMPORT_500_PENDING' : 'ROLLBACK_CONTROLLED_A1_500',
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Thao tác thất bại.');
      setMessage(
        action === 'apply'
          ? `Đã lưu trữ ${payload.result.archived.toLocaleString('vi-VN')} câu cũ và nạp ${payload.result.imported.toLocaleString('vi-VN')} câu A1 chờ duyệt.`
          : `Đã khôi phục ${payload.result.restored.toLocaleString('vi-VN')} câu cũ và lưu trữ ${payload.result.archivedReplacement.toLocaleString('vi-VN')} câu thay thế.`,
      );
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Thao tác thất bại.');
    } finally {
      setBusy(false);
    }
  }

  return <>
    <div className="admin-title"><div><span className="eyebrow">PHÁT HÀNH NỘI DUNG</span><h1>Thay Question Bank bằng 500 câu A1</h1><p>Thao tác có thể hoàn tác: câu cũ được lưu trữ, không bị xóa vật lý.</p></div></div>
    {error && <div className="admin-alert error" role="alert">{error}</div>}
    {message && <div className="admin-alert ok" role="status">{message}</div>}
    {!preview ? <section className="admin-panel"><p>Đang tải bản xem trước…</p></section> : <>
      <section className="metric-grid three">
        <div className="metric"><span>Question Bank hiện tại</span><strong>{preview.existing.toLocaleString('vi-VN')}</strong></div>
        <div className="metric"><span>Sẽ chuyển sang lưu trữ</span><strong>{preview.willArchive.toLocaleString('vi-VN')}</strong></div>
        <div className="metric"><span>Câu A1 mới</span><strong>{preview.willUpsert.toLocaleString('vi-VN')}</strong></div>
      </section>
      <section className="admin-panel">
        <h2>Kiểm tra trước khi áp dụng</h2>
        <p>Release: <strong>{preview.releaseVersion}</strong></p>
        <p>Phân bổ: A1 {preview.byLevel.A1 ?? 0} · A2.1 {preview.byLevel['A2.1'] ?? 0} · A2.2 {preview.byLevel['A2.2'] ?? 0}</p>
        <p>Listening có audio: <strong>{preview.listeningAudio}/125</strong></p>
        <div className="home-actions">
          <button className="primary" disabled={busy || preview.willUpsert !== 500 || preview.listeningAudio !== 125} onClick={() => void mutate('apply')}>{busy ? 'Đang xử lý…' : 'Áp dụng thay thế'}</button>
          <button className="secondary" disabled={busy} onClick={() => void mutate('rollback')}>Hoàn tác release này</button>
        </div>
      </section>
    </>}
  </>;
}
