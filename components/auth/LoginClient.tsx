'use client';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authApi } from '@/lib/api-client';
import type { UserRole } from '@/lib/server/domain';
import { Alert } from '@/components/ui';
import AuthShell from './AuthShell';
import { authErrorMessage } from './auth-errors';

export default function LoginClient() {
  const router=useRouter(), params=useSearchParams(), requested=params.get('next')||'/';
  const next=requested.startsWith('/')&&!requested.startsWith('//')?requested:'/candidate', verified=params.get('verified')==='1';
  const [email,setEmail]=useState(''), [password,setPassword]=useState(''), [show,setShow]=useState(false), [role,setRole]=useState<UserRole>('candidate'), [dev,setDev]=useState(false), [error,setError]=useState(''), [loading,setLoading]=useState(false);
  useEffect(()=>{void fetch('/api/v1/system',{cache:'no-store'}).then(r=>r.json()).then(async x=>{const disabled=x.authentication==='disabled-dev';setDev(disabled);if(!disabled){try{const me=await authApi.me();router.replace(me.user.role==='admin'?'/admin':'/candidate')}catch{/* Login form remains visible. */}}}).catch(()=>{})},[router]);
  async function submit(e:FormEvent){e.preventDefault();setLoading(true);setError('');try{const r=await authApi.login(email,password,dev?role:undefined);router.replace(next==='/'?(r.user.role==='admin'?'/admin':'/candidate'):next)}catch(cause){setError(authErrorMessage(cause,'login'))}finally{setLoading(false)}}
  return <AuthShell><span className="eyebrow">CHÀO MỪNG TRỞ LẠI</span><h1>Đăng nhập</h1><p className="auth-subtitle">Tiếp tục quá trình luyện tập của bạn.</p>{verified&&<Alert tone="success">Email đã được xác minh. Bạn có thể đăng nhập.</Alert>}{error&&<Alert tone="danger">{error}</Alert>}<form onSubmit={submit} className="auth-form"><label htmlFor="login-email">Email</label><input id="login-email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder={dev?'dev@example.com':'ban@example.com'} autoComplete="email" required={!dev} disabled={loading}/>{!dev&&<><label htmlFor="login-password">Mật khẩu</label><div className="password-field"><input id="login-password" type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required disabled={loading}/><button type="button" onClick={()=>setShow(v=>!v)} aria-label={show?'Ẩn mật khẩu':'Hiện mật khẩu'}>{show?'Ẩn':'Hiện'}</button></div></>}{dev&&<><label htmlFor="login-role">Vai trò phát triển</label><select id="login-role" value={role} onChange={e=>setRole(e.target.value as UserRole)} disabled={loading}><option value="candidate">Học viên</option><option value="admin">Quản trị viên</option></select></>}<button type="submit" className="primary auth-submit" disabled={loading}>{loading?'Đang đăng nhập…':'Đăng nhập'}</button></form>{!dev&&<div className="auth-links auth-links-split"><Link href="/forgot-password">Quên mật khẩu?</Link><span>Chưa có tài khoản? <Link href="/register">Tạo tài khoản</Link></span></div>}</AuthShell>;
}
