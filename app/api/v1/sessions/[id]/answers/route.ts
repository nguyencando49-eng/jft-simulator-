import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { apiError } from '@/lib/server/http';
import { getRepository } from '@/lib/server/repository';
import { canAccessSession, expireSessionIfNeeded, validateSessionMutation } from '@/lib/server/session-invariants';

export async function PUT(req:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const auth=await requireAuth(req); const {id}=await params; const repo=getRepository(); const s=await repo.getSession(id);
    if(!s)return NextResponse.json({ok:false,error:'Session not found'},{status:404});
    if(!canAccessSession(s,auth.userId,auth.role))return NextResponse.json({ok:false,error:'FORBIDDEN'},{status:403});
    if(s.status!=='active')return NextResponse.json({ok:false,error:`Session is ${s.status}`},{status:409});
    if(expireSessionIfNeeded(s)){await repo.saveSession(s);return NextResponse.json({ok:false,error:'Session expired'},{status:409});}
    const version=(await repo.listExamVersions()).find(v=>v.id===s.examVersionId);
    if(!version)return NextResponse.json({ok:false,error:'Exam version not found'},{status:404});
    const body=await req.json() as {questionId?:string;choice?:number;currentIndex?:number};
    const invariant=validateSessionMutation(version,s,body);
    if(!invariant.ok)return NextResponse.json({ok:false,error:invariant.error},{status:invariant.status});
    const saved=await repo.saveSessionProgress(s.id,body);
    if(!saved)return NextResponse.json({ok:false,error:'Session changed or expired while saving progress'},{status:409});
    return NextResponse.json({ok:true,savedAt:new Date().toISOString()});
  }catch(e){return apiError(e);}
}
