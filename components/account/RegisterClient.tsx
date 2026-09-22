'use client';
import Link from 'next/link';
import { FormEvent,useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api-client';
import { Alert } from '@/components/ui';

export default function RegisterClient(){
  const router=useRouter();
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[show,setShow]=useState(false),[verificationEmail,setVerificationEmail]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(false);
  async function submit(e:FormEvent){
    e.preventDefault();setLoading(true);setError('');
    try{const r=await authApi.signup(email,password,name);if(r.verificationRequired)setVerificationEmail(email.trim().toLowerCase());else router.replace('/candidate')}
    catch{setError('Không thể tạo tài khoản. Hãy kiểm tra thông tin và thử lại.')}
    finally{setLoading(false)}
  }
  return <main className="auth-page auth-rebuild auth-rebuild-pro">
    <Link href="/" className="candidate-brand auth-brand"><span>日</span><div><b>JFT Practice</b><small>Japanese CBT training</small></div></Link>
    <div className="auth-layout-pro">
      <aside className="auth-story">
        <span className="eyebrow">START PRACTICING</span>
        <h2>Một tài khoản cho toàn bộ quá trình luyện tập.</h2>
        <p>Lưu bài đang làm, xem lại câu sai và theo dõi lịch sử thay vì bắt đầu lại từ đầu ở mỗi phiên.</p>
        <div className="auth-proof-grid">
          <div><b>A1</b><span>Nền tảng</span></div>
          <div><b>A2.1</b><span>Thực hành</span></div>
          <div><b>A2.2</b><span>Nâng cao</span></div>
        </div>
        <div className="auth-story-note"><span>✓</span><p>Đề production có 48 câu, 60 phút và bốn phần kỹ năng trong một luồng CBT.</p></div>
      </aside>
      <section className="auth-card ui-card auth-card-pro">
        {verificationEmail?<div className="verification-state">
          <span className="verification-mark" aria-hidden="true">✓</span>
          <span className="eyebrow">XÁC MINH TÀI KHOẢN</span>
          <h1>Kiểm tra email của bạn</h1>
          <p>Chúng tôi đã gửi liên kết xác minh đến <strong>{verificationEmail}</strong>.</p>
          <Alert tone="success" title="Đăng ký tài khoản thành công">Nhấn vào liên kết trong email để kích hoạt tài khoản, sau đó bạn có thể đăng nhập và bắt đầu luyện tập.</Alert>
          <p className="verification-help">Chưa thấy email? Hãy kiểm tra thư mục Spam/Thư rác và bảo đảm địa chỉ email bạn nhập là chính xác.</p>
          <Link href="/login" className="primary">Đến trang đăng nhập</Link>
          <button type="button" className="verification-back" onClick={()=>setVerificationEmail('')}>Dùng địa chỉ email khác</button>
        </div>:<>
          <span className="eyebrow">TẠO TÀI KHOẢN</span><h1>Bắt đầu luyện tập</h1><p>Tạo tài khoản để lưu tiến độ và kết quả qua từng phiên.</p>
          {error&&<Alert tone="danger">{error}</Alert>}
          <form onSubmit={submit} className="auth-form">
            <label>Tên hiển thị<input value={name} onChange={e=>setName(e.target.value)} maxLength={80} autoComplete="name" placeholder="Tên bạn muốn hiển thị"/></label>
            <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" required/></label>
            <label>Mật khẩu<div className="password-field"><input type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} minLength={8} autoComplete="new-password" required/><button type="button" onClick={()=>setShow(v=>!v)} aria-label={show?'Ẩn nội dung':'Hiện nội dung'}>{show?'Ẩn':'Hiện'}</button></div><small>Tối thiểu 8 ký tự.</small></label>
            <button className="primary auth-submit" disabled={loading}>{loading?'Đang tạo tài khoản…':'Tạo tài khoản'}</button>
          </form>
          <div className="auth-links"><Link href="/login">Đã có tài khoản? Đăng nhập</Link></div>
          <p className="auth-disclaimer">Trình mô phỏng luyện tập JFT-Basic không chính thức.</p>
        </>}
      </section>
    </div>
  </main>;
}
