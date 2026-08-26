import Link from 'next/link';

const features = [
  ['01', 'Mô phỏng CBT', 'Làm quen cách chuyển phần, chọn đáp án và quản lý thời gian.'],
  ['02', 'Listening', 'Luyện nghe trực tiếp với audio trong bài thi.'],
  ['03', 'Lưu tiến độ', 'Đáp án được lưu trong quá trình làm bài.'],
  ['04', 'Xem lại câu sai', 'Kiểm tra đáp án và phần cần luyện thêm sau khi hoàn thành.'],
];
const levels = [
  ['A1', 'Luyện các tình huống và ngôn ngữ cơ bản trong đời sống hằng ngày.'],
  ['A2.1', 'Tăng khả năng xử lý hội thoại và thông tin thực tế.'],
  ['A2.2', 'Luyện các tình huống A2 với lượng thông tin và xử lý cao hơn.'],
];
const steps = [
  ['1', 'Chọn đề', 'Chọn cấp độ và bài luyện tập phù hợp.'],
  ['2', 'Làm bài CBT', 'Làm từng phần với timer, audio và lưu đáp án.'],
  ['3', 'Xem kết quả', 'Xem điểm luyện tập và kiểm tra lại câu sai.'],
];

export default function Home() {
  return <div className="public-site">
    <header className="public-nav">
      <Link href="/" className="public-brand" aria-label="JFT Simulator — Trang chủ"><span aria-hidden="true">J</span><b>JFT Simulator</b></Link>
      <nav aria-label="Điều hướng chính"><a href="#levels">Cấp độ</a><a href="#practice">Nội dung luyện tập</a><a href="#how-it-works">Cách hoạt động</a></nav>
      <div className="page-actions"><Link href="/login" className="secondary">Đăng nhập</Link><Link href="/register" className="primary">Thi thử miễn phí</Link></div>
    </header>
    <main>
      <section className="public-hero" aria-labelledby="hero-title">
        <div className="public-hero-copy"><span className="eyebrow">JFT-BASIC PRACTICE</span><h1 id="hero-title">Thi thử JFT theo trải nghiệm CBT</h1><p>Luyện bốn kỹ năng, lưu tiến độ, xem kết quả và kiểm tra lại những câu bạn làm sai.</p><div className="hero-actions"><Link href="/register" className="primary">Thi thử miễn phí</Link><Link href="/login" className="secondary">Đăng nhập</Link></div><small>Không cần cài đặt. Làm bài trực tiếp trên trình duyệt.</small></div>
        <div className="product-preview" aria-label="Bản xem trước giao diện bài thi CBT">
          <div className="preview-topbar"><div><b>JFT Practice A1</b><span>Nghe hiểu</span></div><time>42:18</time></div>
          <div className="preview-progress-meta"><span>Câu 12 / 40</span><span>30%</span></div><div className="preview-progress" aria-hidden="true"><span /></div>
          <div className="preview-question"><span className="preview-kicker">問題 12</span><div className="preview-audio"><i aria-hidden="true" /><span>Phát âm thanh</span><small>còn 1 lần nghe</small></div><p lang="ja">いちばん いいものを<br />えらんでください。</p><div className="preview-options" aria-hidden="true">{['選択肢 A','選択肢 B','選択肢 C','選択肢 D'].map((choice,index)=><div className={index===1?'selected':''} key={choice}><span>{String.fromCharCode(65+index)}</span>{choice}</div>)}</div><div className="preview-saved"><span aria-hidden="true">✓</span> Đã lưu</div></div>
        </div>
      </section>
      <section id="practice" className="public-section public-value" aria-labelledby="value-title"><div className="section-intro"><span className="eyebrow">TRỌN QUY TRÌNH</span><h2 id="value-title">Một nơi để luyện tập trọn quy trình</h2></div><div className="value-grid">{features.map(([number,title,description])=><article key={number}><span>{number}</span><h3>{title}</h3><p>{description}</p></article>)}</div></section>
      <section id="levels" className="public-section public-levels" aria-labelledby="levels-title"><div className="section-intro"><span className="eyebrow">CẤP ĐỘ LUYỆN TẬP</span><h2 id="levels-title">Chọn cấp độ luyện tập</h2><p>Mỗi cấp độ tập trung vào khả năng sử dụng tiếng Nhật trong tình huống thực tế.</p></div><div className="level-grid">{levels.map(([level,description])=><article className="level-card" key={level}><span>{level}</span><h3>Thực hành {level}</h3><p>{description}</p></article>)}</div></section>
      <section id="how-it-works" className="public-section public-how" aria-labelledby="how-title"><div className="section-intro"><span className="eyebrow">BẮT ĐẦU ĐƠN GIẢN</span><h2 id="how-title">Luyện tập chỉ với 3 bước</h2></div><div className="steps-grid">{steps.map(([number,title,description])=><article key={number}><span>{number}</span><div><h3>{title}</h3><p>{description}</p></div></article>)}</div></section>
      <section className="public-cta" aria-labelledby="cta-title"><div><h2 id="cta-title">Sẵn sàng làm bài đầu tiên?</h2><p>Tạo tài khoản miễn phí để lưu tiến độ và xem lại kết quả.</p></div><div className="page-actions"><Link href="/register" className="primary">Thi thử miễn phí</Link><Link href="/login" className="secondary">Đăng nhập</Link></div></section>
    </main>
    <footer className="public-footer"><div><b>JFT Simulator</b><p>Công cụ luyện thi JFT theo trải nghiệm CBT.</p></div><div className="footer-links"><Link href="/login">Đăng nhập</Link><Link href="/register">Đăng ký</Link></div><p className="public-disclaimer">JFT Simulator là công cụ luyện tập không chính thức và không được Japan Foundation hoặc Prometric bảo trợ hoặc chứng nhận.</p></footer>
  </div>;
}
