import Link from 'next/link';

const levels=[
  ['A1','Xây nền giao tiếp trong những tình huống quen thuộc hằng ngày.'],
  ['A2.1','Luyện xử lý hội thoại, hướng dẫn và thông tin thực tế.'],
  ['A2.2','Tăng độ khó với tình huống cần kết hợp nhiều thông tin hơn.'],
];
const features=[
  ['語彙','Chữ viết & Từ vựng','Nhận biết từ, cách dùng và chữ Hán trong ngữ cảnh.'],
  ['会話','Hội thoại & Biểu đạt','Chọn cách phản hồi phù hợp với tình huống giao tiếp.'],
  ['聴解','Nghe hiểu','Nghe hội thoại và thông báo thực tế bằng tiếng Nhật.'],
  ['読解','Đọc hiểu','Đọc tin nhắn, lịch, thông báo và thông tin đời sống.'],
];

export default function Home(){
  return <main className="public-site">
    <header className="public-nav">
      <Link href="/" className="candidate-brand"><span>日</span><b>JFT Practice</b></Link>
      <nav><a href="#levels">Cấp độ</a><a href="#practice">Nội dung</a><a href="#quality">Chất lượng</a></nav>
      <div className="page-actions"><Link href="/login" className="secondary">Đăng nhập</Link><Link href="/register" className="primary">Bắt đầu</Link></div>
    </header>

    <section className="public-hero">
      <div>
        <span className="eyebrow">JAPANESE FOR EVERYDAY LIFE</span>
        <h1>Luyện JFT theo trải nghiệm CBT, tập trung vào tình huống thật</h1>
        <p>Ba mức luyện A1–A2.2, bốn phần thi và hệ thống lưu tiến độ để bạn có thể luyện đều, xem lại câu sai và tiếp tục trên nhiều phiên.</p>
        <div className="hero-actions"><Link href="/candidate" className="primary">Vào khu luyện tập</Link><Link href="/register" className="secondary">Tạo tài khoản</Link></div>
        <small>Đây là sản phẩm luyện tập không chính thức, không phải đề thi JFT-Basic thật.</small>
      </div>
      <div className="hero-japanese" aria-label="Japanese practice overview">
        <span>毎日の日本語</span>
        <b>語彙 · 会話 · 聴解 · 読解</b>
        <p>生活と仕事のために</p>
        <div className="hero-mini-stats"><strong>3,000</strong><span>câu trong ngân hàng nội dung có kiểm soát</span></div>
      </div>
    </section>

    <section className="public-stats" aria-label="Product highlights">
      <div><strong>3</strong><span>mức luyện A1–A2.2</span></div>
      <div><strong>4</strong><span>phần kỹ năng</span></div>
      <div><strong>3,000</strong><span>câu trong ngân hàng nội dung</span></div>
      <div><strong>QA</strong><span>kiểm tra trước khi phát hành</span></div>
    </section>

    <section id="levels" className="public-section">
      <div className="section-intro"><span className="eyebrow">PRACTICE LEVELS</span><h2>Chọn đúng mức để luyện có mục tiêu</h2><p>A1, A2.1 và A2.2 là phân tầng nội bộ của sản phẩm luyện tập, giúp chia nội dung theo độ phức tạp.</p></div>
      <div className="level-grid">{levels.map(([level,text])=><article className="level-card" key={level}><span>{level}</span><h3>Thực hành {level}</h3><p>{text}</p></article>)}</div>
    </section>

    <section id="practice" className="public-section soft">
      <div className="section-intro"><span className="eyebrow">CBT PRACTICE</span><h2>Bốn phần luyện trong một trải nghiệm thống nhất</h2><p>Làm bài theo phiên có thời gian, tự động lưu đáp án và xem giải thích sau khi nộp.</p></div>
      <div className="feature-grid">{features.map(([jp,vi,desc])=><article key={jp}><b>{jp}</b><span>{vi}</span><p>{desc}</p></article>)}</div>
    </section>

    <section id="quality" className="public-section quality-section">
      <div className="section-intro"><span className="eyebrow">CONTENT QUALITY</span><h2>Không đưa câu hỏi lên đề chỉ vì “đúng format”</h2><p>Ngân hàng nội dung tách trạng thái nháp, review và approved. Câu được tạo mới phải qua kiểm tra cấu trúc, đáp án, tiếng Nhật, bám chương trình, mức phù hợp, độ khó và trùng lặp trước khi được phát hành.</p></div>
      <div className="quality-flow"><span>Soạn câu</span><i>→</i><span>QA</span><i>→</i><span>Duyệt</span><i>→</i><span>Đóng băng đề</span><i>→</i><span>Làm bài</span></div>
    </section>

    <section className="public-cta"><h2>Sẵn sàng bắt đầu?</h2><p>Tạo tài khoản để lưu bài đang làm, xem lịch sử và review đáp án sau khi nộp.</p><Link href="/register" className="primary">Tạo tài khoản miễn phí</Link></section>
    <footer className="public-footer"><b>JFT Practice</b><p>Trình mô phỏng luyện tập JFT-Basic không chính thức. Không được Japan Foundation hoặc Prometric bảo trợ hay chứng nhận.</p></footer>
  </main>;
}
