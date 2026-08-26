'use client';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { authApi } from '@/lib/api-client';
import { Alert } from '@/components/ui';
import AuthShell from '@/components/auth/AuthShell';
import { authErrorMessage } from '@/components/auth/auth-errors';

export default function ForgotPasswordClient(){
  const [email,setEmail]=useState(''),[error,setError]=useState(''),[done,setDone]=useState(false),[loading,setLoading]=useState(false);
  async function submit(e:FormEvent){e.preventDefault();setLoading(true);setError('');try{await authApi.recover(email);setDone(true)}catch(cause){setError(authErrorMessage(cause,'recover'))}finally{setLoading(false)}}
  return <AuthShell><span className="eyebrow">KHÔI PHỤC TÀI KHOẢN</span><h1>Quên mật khẩu?</h1><p className="auth-subtitle">Nhập email đã đăng ký. Chúng tôi sẽ gửi liên kết đặt lại mật khẩu.</p>{error&&<Alert tone="danger">{error}</Alert>}{done?<><Alert tone="success" title="Đã gửi liên kết đặt lại mật khẩu">Hãy kiểm tra hộp thư của bạn.</Alert><p className="auth-help">Nếu chưa thấy email, hãy kiểm tra thư mục Spam/Thư rác.</p></>:<form onSubmit={submit} className="auth-form"><label htmlFor="recover-email">Email</label><input id="recover-email" type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required disabled={loading}/><button type="submit" className="primary auth-submit" disabled={loading}>{loading?'Đang gửi…':'Gửi liên kết'}</button></form>}<div className="auth-links auth-links-centered"><Link href="/login">Quay lại đăng nhập</Link></div></AuthShell>;
}
