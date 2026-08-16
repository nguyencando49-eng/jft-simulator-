import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { apiError } from '@/lib/server/http';

const ALLOWED = new Set(['audio/mpeg','audio/wav','audio/ogg','image/png','image/jpeg','image/webp']);
export async function POST(req:Request){
  try{
    await requireAuth(req,'admin');
    const url=process.env.SUPABASE_URL; const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(!url||!key) return NextResponse.json({ok:false,error:'Asset upload requires Supabase storage configuration.'},{status:501});
    const form=await req.formData(); const file=form.get('file');
    if(!(file instanceof File)) return NextResponse.json({ok:false,error:'file is required'},{status:422});
    if(!ALLOWED.has(file.type)) return NextResponse.json({ok:false,error:`Unsupported file type: ${file.type}`},{status:415});
    if(file.size>15*1024*1024) return NextResponse.json({ok:false,error:'Maximum file size is 15MB.'},{status:413});
    const bucket=String(form.get('bucket')||'exam-assets');
    const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_'); const path=`${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}-${safe}`;
    const res=await fetch(`${url.replace(/\/$/,'')}/storage/v1/object/${encodeURIComponent(bucket)}/${path}`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':file.type,'x-upsert':'false'},body:await file.arrayBuffer()});
    if(!res.ok) return NextResponse.json({ok:false,error:await res.text()},{status:res.status});
    return NextResponse.json({ok:true,bucket,path,contentType:file.type,size:file.size},{status:201});
  }catch(e){return apiError(e);}
}
