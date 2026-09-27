import { NextResponse } from 'next/server';
import { authDisabled } from '@/lib/server/auth';

export async function POST(req:Request){
  let body:unknown;
  try{body=await req.json();}catch{return NextResponse.json({ok:false,error:'Invalid JSON'},{status:400});}
  const email=body&&typeof body==='object'&&'email' in body?body.email:undefined;
  if(typeof email!=='string'||email.length>254||!/^\S+@\S+\.\S+$/.test(email.trim()))
    return NextResponse.json({ok:false,error:'A valid email is required.'},{status:422});
  if(authDisabled())return NextResponse.json({ok:true,mode:'dev'});
  const url=process.env.SUPABASE_URL,anon=process.env.SUPABASE_ANON_KEY;
  if(!url||!anon)return NextResponse.json({ok:false,error:'AUTH_NOT_CONFIGURED'},{status:503});
  try{
    const origin=new URL(req.url).origin;
    const response=await fetch(`${url.replace(/\/$/,'')}/auth/v1/recover?redirect_to=${encodeURIComponent(`${origin}/reset-password`)}`,{
      method:'POST',headers:{apikey:anon,'Content-Type':'application/json'},
      body:JSON.stringify({email:email.trim()}),cache:'no-store',signal:AbortSignal.timeout(15_000),
    });
    // Do not expose account existence or report success after provider failure.
    if(!response.ok)return NextResponse.json({ok:false,error:'Recovery is temporarily unavailable. Please try again later.'},{status:response.status===429?429:502});
    return NextResponse.json({ok:true});
  }catch{return NextResponse.json({ok:false,error:'Recovery is temporarily unavailable. Please try again later.'},{status:502});}
}
