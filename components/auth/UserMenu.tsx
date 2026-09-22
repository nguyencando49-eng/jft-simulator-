'use client';
import { useEffect,useMemo,useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi,UserProfile } from '@/lib/api-client';

export default function UserMenu({compact=false}:{compact?:boolean}){
  const [user,setUser]=useState<UserProfile|null>(null);
  const router=useRouter();
  useEffect(()=>{void authApi.me().then(r=>setUser(r.user)).catch(()=>{})},[]);
  const initial=useMemo(()=>{const label=user?.displayName||user?.email||'J';return label.trim().charAt(0).toUpperCase()||'J'},[user]);
  if(!user)return null;
  return <div className={compact?'user-menu compact user-menu-pro':'user-menu user-menu-pro'}>
    <span className="user-avatar" aria-hidden="true">{initial}</span>
    <div><b>{user.displayName||user.email}</b><small>{user.role==='admin'?'Quản trị viên':'Học viên'}</small></div>
    <button onClick={async()=>{await authApi.logout();router.replace('/login')}}>Đăng xuất</button>
  </div>;
}
