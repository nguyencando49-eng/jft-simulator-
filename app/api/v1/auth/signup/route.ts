import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, DEV_ROLE_COOKIE, DEV_USER_COOKIE, REFRESH_COOKIE, authDisabled, devUserId } from '@/lib/server/auth';
import { getRepository } from '@/lib/server/repository';

const cookieBase={httpOnly:true,sameSite:'lax' as const,secure:process.env.NODE_ENV==='production',path:'/'};
export async function POST(req:Request){
  const body=await req.json() as {email?:string;password?:string;displayName?:string};
  if(!body.email||!body.password)return NextResponse.json({ok:false,error:'Email and password are required.'},{status:422});
  if(body.password.length<8)return NextResponse.json({ok:false,error:'Password must be at least 8 characters.'},{status:422});
  if(authDisabled()){
    const now=new Date().toISOString(); const email=body.email.trim().toLowerCase(); const profile={id:devUserId('candidate',email),email,displayName:body.displayName?.trim()||email.split('@')[0],role:'candidate' as const,createdAt:now,lastSeenAt:now};
    await getRepository().upsertProfile(profile); const res=NextResponse.json({ok:true,user:profile,mode:'dev',verificationRequired:false});
    res.cookies.set(DEV_ROLE_COOKIE,'candidate',{...cookieBase,maxAge:60*60*24*30}); res.cookies.set(DEV_USER_COOKIE,email,{...cookieBase,maxAge:60*60*24*30}); return res;
  }
  const url=process.env.SUPABASE_URL,anon=process.env.SUPABASE_ANON_KEY;if(!url||!anon)return NextResponse.json({ok:false,error:'AUTH_NOT_CONFIGURED'},{status:500});
  const origin=new URL(req.url).origin; const r=await fetch(`${url.replace(/\/$/,'')}/auth/v1/signup?redirect_to=${encodeURIComponent(`${origin}/login?verified=1`)}`,{method:'POST',headers:{apikey:anon,'Content-Type':'application/json'},body:JSON.stringify({email:body.email,password:body.password,data:{display_name:body.displayName?.trim()||undefined}}),cache:'no-store'}); const p=await r.json();
  if(!r.ok)return NextResponse.json({ok:false,error:p.msg||p.error_description||'Sign up failed'},{status:400});
  if(p.session?.access_token){const res=NextResponse.json({ok:true,mode:'supabase',verificationRequired:false});res.cookies.set(ACCESS_COOKIE,p.session.access_token,{...cookieBase,maxAge:Math.max(60,p.session.expires_in||3600)});if(p.session.refresh_token)res.cookies.set(REFRESH_COOKIE,p.session.refresh_token,{...cookieBase,maxAge:60*60*24*30});return res;}
  return NextResponse.json({ok:true,mode:'supabase',verificationRequired:true});
}
