import Link from 'next/link';

const levels=[
  {level:'A1',title:'Nền tảng',text:'Tình huống quen thuộc, câu ngắn và thông tin trực tiếp.',tone:'starter'},
  {level:'A2.1',title:'Thực hành',text:'Hội thoại, hướng dẫn và thông tin thực tế có thêm một bước suy luận.',tone:'core'},
  {level:'A2.2',title:'Nâng cao',text:'Kết hợp nhiều chi tiết hơn trong bối cảnh đời sống và công việc.',tone:'advanced'},
];
const features=[
  ['語彙','Chữ viết & Từ vựng','Nhận biết từ, cách dùng và chữ Hán trong ngữ cảnh.'],
  ['会話','Hội thoại & Biểu đạt','Chọn phản hồi phù hợp với mục đích và ngữ cảnh giao tiếp.'],
  ['聴解','Nghe hiểu','Nghe hội thoại, thông báo và hướng dẫn bằng audio thực tế.'],
  ['読解','Đọc hiểu','Đọc tin nhắn, lịch, biển báo và thông tin đời sống.'],
];

export default function Home(){
  return <main className="public-site public-site-pro">
    <header className="public-nav public-nav-pro">
      <Link href="/" className="candidate-brand public-brand"><span>日</span><div><b>JFT Practice</b><small>Japanese CBT training</small></div></Link>
      <nav aria-label="Điều hướng chính"><a href="#levels">Cấp độ</a><a href="#practice">Nội dung</a><a href="#quality">Chất lượng</a></nav>
      <div className="page-actions"><Link href="/login" className="secondary">Đăng nhập</Link><Link href="/register" className="primary">Luyện ngay</Link></div>
    </header>

    <section className="public-hero public-hero-pro">
      <div className="hero-copy">
        <div className="hero-kicker"><span>3.000 câu hỏi</span><i>•</i><span>4 phần kỹ năng</span><i>•</i><span>Audio nghe hiểu</span></div>
        <span className="eyebrow">JFT PRACTICE PLATFORM</span>
        <h1>Luyện JFT có cấu trúc, theo đúng nhịp của một bài CBT.</h1>
        <p>Không chỉ là một danh sách câu hỏi. Bạn có đề theo cấp độ, đồng hồ làm bài, tự lưu đáp án, phần Nghe hiểu có audio và trang review sau khi nộp.</p>
        <div className="hero-actions"><Link href="/candidate" className="primary">Vào khu luyện tập</Link><Link href="#practice" className="secondary">Xem cách luyện</Link></div>
        <div className="hero-trust"><span><b>3 mức</b>A1 · A2.1 · A2.2</span><span><b>48 câu</b>mỗi đề production</span><span><b>60 phút</b>mỗi phiên luyện</span></div>
        <small>Trình mô phỏng luyện tập không chính thức, không phải đề thi JFT-Basic thật.</small>
      </div>

      <div className="hero-product-card" aria-label="Mô phỏng giao diện luyện tập">
        <div className="hero-product-top"><div><span className="brand-dot">日</span><b>JFT Practice</b></div><span className="hero-live">Practice mode</span></div>
        <div className="hero-product-progress"><span>Nghe hiểu</span><b>Câu 7 / 12</b></div>
        <div className="hero-product-body">
          <span className="hero-section-label">聴解 · A2.1</span>
          <div className="hero-audio-card"><button aria-hidden="true" tabIndex={-1}>▶</button><div><b>Âm thanh sẵn sàng</b><span>Còn 2 / 2 lượt phát</span></div><i></i></div>
          <p lang="ja">お知らせを聞いて、いちばんいい答えを一つ選んでください。</p>
          <div className="hero-choice"><span>A</span><b>受付へ行きます</b></div>
          <div className="hero-choice active"><span>B</span><b>案内を確認します</b></div>
          <div className="hero-choice"><span>C</span><b>担当者に電話します</b></div>
        </div>
        <div className="hero-product-foot"><span>Đã lưu tự động</span><button aria-hidden="true" tabIndex={-1}>Tiếp theo</button></div>
      </div>
    </section>

    <section className="public-stats public-stats-pro" aria-label="Điểm nổi bật">
      <div><strong>3.000</strong><span>câu trong ngân hàng kiểm soát</span></div>
      <div><strong>525</strong><span>audio trong kho nghe hiểu</span></div>
      <div><strong>3</strong><span>đề production theo cấp độ</span></div>
      <div><strong>QA</strong><span>kiểm tra trước khi phát hành</span></div>
    </section>

    <section id="levels" className="public-section public-section-pro">
      <div className="section-intro"><span className="eyebrow">PRACTICE LEVELS</span><h2>Chọn đúng mức. Luyện đúng tải.</h2><p>A1, A2.1 và A2.2 là phân tầng nội bộ của hệ thống luyện tập để bạn tăng độ khó có kiểm soát.</p></div>
      <div className="level-grid level-grid-pro">{levels.map(item=><article className={'level-card level-card-pro '+item.tone} key={item.level}><div className="level-card-top"><span>{item.level}</span><small>{item.title}</small></div><h3>Thực hành {item.level}</h3><p>{item.text}</p><Link href="/candidate">Mở danh sách đề <b>→</b></Link></article>)}</div>
    </section>

    <section id="practice" className="public-section public-section-pro soft">
      <div className="section-intro"><span className="eyebrow">CBT PRACTICE</span><h2>Một luồng luyện tập thống nhất cho bốn phần.</h2><p>Giao diện ưu tiên nội dung, trạng thái rõ ràng và thao tác nhanh cả trên desktop lẫn mobile.</p></div>
      <div className="feature-grid feature-grid-pro">{features.map(([jp,vi,desc],index)=><article key={jp}><div className="feature-number">0{index+1}</div><b>{jp}</b><span>{vi}</span><p>{desc}</p></article>)}</div>
    </section>

    <section id="quality" className="public-section public-section-pro quality-section quality-section-pro">
      <div className="section-intro"><span className="eyebrow">CONTENT QUALITY</span><h2>Chất lượng câu hỏi được kiểm soát trước khi lên đề.</h2><p>Mỗi câu đi qua kiểm tra cấu trúc, đáp án, tiếng Nhật, bám chương trình, mức phù hợp, độ khó và trùng lặp. Đề đã phát hành được đóng băng thành snapshot để không thay đổi giữa chừng.</p></div>
      <div className="quality-flow quality-flow-pro"><span>Soạn câu</span><i>→</i><span>QA</span><i>→</i><span>Duyệt</span><i>→</i><span>Đóng băng đề</span><i>→</i><span>Làm bài</span></div>
    </section>

    <section className="public-cta public-cta-pro"><span className="eyebrow">READY TO PRACTICE?</span><h2>Bắt đầu bằng một đề vừa sức.</h2><p>Tạo tài khoản để lưu bài đang làm, lịch sử và kết quả review sau mỗi phiên.</p><div><Link href="/register" className="primary">Tạo tài khoản</Link><Link href="/login" className="secondary">Tôi đã có tài khoản</Link></div></section>
    <footer className="public-footer public-footer-pro"><div><b>JFT Practice</b><span>Japanese CBT training</span></div><p>Trình mô phỏng luyện tập JFT-Basic không chính thức. Không được Japan Foundation hoặc Prometric bảo trợ hay chứng nhận.</p></footer>
  </main>;
}
