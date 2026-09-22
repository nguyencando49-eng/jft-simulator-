'use client';

import Link from 'next/link';
import { FormEvent,useEffect,useState } from 'react';
import { useRouter,useSearchParams } from 'next/navigation';
import { authApi } from '@/lib/api-client';
import type { UserRole } from '@/lib/server/domain';
import { Alert } from '@/components/ui';

export default function LoginClient(){
  const router=useRouter(),params=useSearchParams();
  const requested=params.get('next')||'/';
  const next=requested.startsWith('/')&&!requested.startsWith('//')?requested:'/candidate';
  const verified=params.get('verified')==='1';
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[show,setShow]=useState(false),[role,setRole]=useState<UserRole>('candidate'),[dev,setDev]=useState(false),[error,setError]=useState(''),[loading,setLoading]=useState(false);

  useEffect(()=>{
    void fetch('/api/v1/system',{cache:'no-store'}).then(r=>r.json()).then(async x=>{
      const disabled=x.authentication==='disabled-dev';
      setDev(disabled);
      if(!disabled){try{const me=await authApi.me();router.replace(me.user.role==='admin'?'/admin':'/candidate')}catch{/* Login form remains visible. */}}
    }).catch(()=>{});
  },[router]);

  async function submit(e:FormEvent){
    e.preventDefault();setLoading(true);setError('');
    try{const r=await authApi.login(email,password,dev?role:undefined);router.replace(next==='/'?(r.user.role==='admin'?'/admin':'/candidate'):next)}
    catch{setError('Email hoặc mật khẩu không đúng. Vui lòng kiểm tra và thử lại.')}
    finally{setLoading(false)}
  }

  return <main className="auth-page auth-rebuild auth-rebuild-pro">
    <Link href="/" className="candidate-brand auth-brand"><span>日</span><div><b>JFT Practice</b><small>Japanese CBT training</small></div></Link>
    <div className="auth-layout-pro">
      <aside className="auth-story">
        <span className="eyebrow">WELCOME BACK</span>
        <h2>Tiếp tục đúng nơi bạn đã dừng.</h2>
        <p>Tài khoản giúp đồng bộ tiến độ, lưu đáp án và giữ lịch sử kết quả giữa các phiên luyện.</p>
        <div className="auth-proof-grid">
          <div><b>3.000</b><span>câu hỏi</span></div>
          <div><b>525</b><span>audio nghe hiểu</span></div>
          <div><b>3</b><span>cấp độ luyện</span></div>
        </div>
        <div className="auth-story-note"><span>✓</span><p>Đáp án đang làm được lưu trên máy chủ và có thể tiếp tục sau khi đăng nhập lại.</p></div>
      </aside>
      <section className="auth-card ui-card auth-card-pro">
        <span className="eyebrow">ĐĂNG NHẬP</span>
        <h1>Chào mừng trở lại</h1>
        <p>Đăng nhập để tiếp tục bài đang làm và xem lịch sử luyện tập.</p>
        {verified&&<Alert tone="success">Email đã được xác minh. Bạn có thể đăng nhập.</Alert>}
        {error&&<Alert tone="danger">{error}</Alert>}
        <form onSubmit={submit} className="auth-form">
          <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder={dev?'dev@example.com':'you@example.com'} autoComplete="email" required={!dev}/></label>
          {!dev&&<label>Mật khẩu<div className="password-field"><input type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required/><button type="button" onClick={()=>setShow(v=>!v)} aria-label={show?'Ẩn mật khẩu':'Hiện mật khẩu'}>{show?'Ẩn':'Hiện'}</button></div></label>}
          {dev&&<label>Vai trò phát triển<select value={role} onChange={e=>setRole(e.target.value as UserRole)}><option value="candidate">Học viên</option><option value="admin">Quản trị viên</option></select></label>}
          <button className="primary auth-submit" disabled={loading}>{loading?'Đang đăng nhập…':'Đăng nhập'}</button>
        </form>
        {!dev&&<div className="auth-links"><Link href="/forgot-password">Quên mật khẩu?</Link><Link href="/register">Tạo tài khoản</Link></div>}
        {dev&&<Alert tone="warning">Chế độ đăng nhập phát triển đang bật.</Alert>}
        <p className="auth-disclaimer">Trình mô phỏng luyện tập JFT-Basic không chính thức.</p>
      </section>
    </div>
  </main>;
}
