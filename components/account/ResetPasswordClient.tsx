'use client';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { authApi } from '@/lib/api-client';
import { Alert } from '@/components/ui';
import AuthShell from '@/components/auth/AuthShell';
import { authErrorMessage } from '@/components/auth/auth-errors';

export default function ResetPasswordClient(){
  const [token,setToken]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[error,setError]=useState(''),[done,setDone]=useState(false),[loading,setLoading]=useState(false);
  useEffect(()=>{const h=new URLSearchParams(location.hash.replace(/^#/,''));setToken(h.get('access_token')||new URLSearchParams(location.search).get('access_token')||'')},[]);
  async function submit(e:FormEvent){e.preventDefault();setError('');if(password!==confirm){setError('Hai mật khẩu chưa khớp.');return}try{setLoading(true);await authApi.resetPassword(token,password);setDone(true)}catch(cause){setError(authErrorMessage(cause,'reset'))}finally{setLoading(false)}}
  return <AuthShell><span className="eyebrow">KHÔI PHỤC TÀI KHOẢN</span><h1>Đặt lại mật khẩu</h1><p className="auth-subtitle">Tạo mật khẩu mới cho tài khoản của bạn.</p>{error&&<Alert tone="danger">{error}</Alert>}{done?<><Alert tone="success">Mật khẩu đã được cập nhật.</Alert><Link href="/login" className="primary auth-inline-cta">Đăng nhập</Link></>:<form onSubmit={submit} className="auth-form"><label htmlFor="reset-password">Mật khẩu mới</label><input id="reset-password" type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={8} autoComplete="new-password" required disabled={loading}/><label htmlFor="reset-confirm">Xác nhận mật khẩu</label><input id="reset-confirm" type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} minLength={8} autoComplete="new-password" required disabled={loading}/><button type="submit" className="primary auth-submit" disabled={loading}>{loading?'Đang cập nhật…':'Cập nhật mật khẩu'}</button></form>}</AuthShell>;
}
