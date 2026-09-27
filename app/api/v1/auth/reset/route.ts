import { NextResponse } from 'next/server';
import { authDisabled } from '@/lib/server/auth';

export async function POST(req:Request){
  let body:{accessToken?:unknown;password?:unknown}|null;
  try{body=await req.json();}catch{return NextResponse.json({ok:false,error:'Invalid JSON'},{status:400});}
  if(typeof body?.password!=='string'||body.password.length<8)
    return NextResponse.json({ok:false,error:'Password must be at least 8 characters.'},{status:422});
  if(authDisabled())return NextResponse.json({ok:true,mode:'dev'});
  if(typeof body.accessToken!=='string'||!body.accessToken.trim())
    return NextResponse.json({ok:false,error:'Recovery token is missing or expired.'},{status:401});
  const url=process.env.SUPABASE_URL,anon=process.env.SUPABASE_ANON_KEY;
  if(!url||!anon)return NextResponse.json({ok:false,error:'AUTH_NOT_CONFIGURED'},{status:503});
  try{
    const response=await fetch(`${url.replace(/\/$/,'')}/auth/v1/user`,{
      method:'PUT',headers:{apikey:anon,Authorization:`Bearer ${body.accessToken}`,'Content-Type':'application/json'},
      body:JSON.stringify({password:body.password}),cache:'no-store',signal:AbortSignal.timeout(15_000),
    });
    if(!response.ok)return NextResponse.json({ok:false,error:'Password reset failed. Request a new recovery link and try again.'},{status:response.status===429?429:response.status>=500?502:400});
    return NextResponse.json({ok:true});
  }catch{return NextResponse.json({ok:false,error:'Password reset is temporarily unavailable.'},{status:502});}
}
