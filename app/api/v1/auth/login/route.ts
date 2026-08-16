import { NextResponse } from 'next/server';
import { ACCESS_COOKIE,DEV_ROLE_COOKIE,DEV_USER_COOKIE,REFRESH_COOKIE,authDisabled } from '@/lib/server/auth';
import { getRepository } from '@/lib/server/repository';
import type { UserRole } from '@/lib/server/domain';

const secure=process.env.NODE_ENV==='production';
const cookieBase={httpOnly:true,sameSite:'lax' as const,secure,path:'/'};
export async function POST(req:Request){
  const body=await req.json() as {email?:string;password?:string;role?:UserRole};
  if(authDisabled()){
    const role:UserRole=body.role==='candidate'?'candidate':'admin'; const email=(body.email||`dev-${role}@local.test`).trim();
    const now=new Date().toISOString(); const profile={id:`dev-${role}`,email,displayName:role==='admin'?'Dev Admin':'Dev Candidate',role,createdAt:now,lastSeenAt:now};
    await getRepository().upsertProfile(profile);
    const res=NextResponse.json({ok:true,user:profile,mode:'dev'});
    res.cookies.set(DEV_ROLE_COOKIE,role,{...cookieBase,maxAge:60*60*24*30}); res.cookies.set(DEV_USER_COOKIE,email,{...cookieBase,maxAge:60*60*24*30}); return res;
  }
  if(!body.email||!body.password)return NextResponse.json({ok:false,error:'Email and password are required.'},{status:422});
  const url=process.env.SUPABASE_URL,anon=process.env.SUPABASE_ANON_KEY; if(!url||!anon)return NextResponse.json({ok:false,error:'AUTH_NOT_CONFIGURED'},{status:500});
  const authRes=await fetch(`${url.replace(/\/$/,'')}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:anon,'Content-Type':'application/json'},body:JSON.stringify({email:body.email,password:body.password}),cache:'no-store'});
  const payload=await authRes.json(); if(!authRes.ok)return NextResponse.json({ok:false,error:payload.error_description||payload.msg||'Invalid credentials'},{status:401});
  const user=payload.user; const role=(user.app_metadata?.role==='admin'?'admin':'candidate') as UserRole; const now=new Date().toISOString();
  const existing=await getRepository().getProfile(user.id); const profile={id:user.id,email:user.email||body.email,displayName:user.user_metadata?.display_name||user.user_metadata?.full_name,role,createdAt:existing?.createdAt||now,lastSeenAt:now}; await getRepository().upsertProfile(profile);
  const res=NextResponse.json({ok:true,user:profile,mode:'supabase'}); res.cookies.set(ACCESS_COOKIE,payload.access_token,{...cookieBase,maxAge:Math.max(60,payload.expires_in||3600)}); res.cookies.set(REFRESH_COOKIE,payload.refresh_token,{...cookieBase,maxAge:60*60*24*30}); return res;
}
