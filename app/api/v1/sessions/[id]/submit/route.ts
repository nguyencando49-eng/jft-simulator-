import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { apiError } from '@/lib/server/http';
import { getRepository } from '@/lib/server/repository';
import { canAccessSession, finalizeSessionForSubmission } from '@/lib/server/session-invariants';
import { scoreFrozenExam } from '@/lib/server/server-scoring';

export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const auth=await requireAuth(req); const {id}=await params; const repo=getRepository(); const s=await repo.getSession(id);
    if(!s)return NextResponse.json({ok:false,error:'Session not found'},{status:404});
    if(!canAccessSession(s,auth.userId,auth.role))return NextResponse.json({ok:false,error:'FORBIDDEN'},{status:403});
    if(s.status==='submitted')return NextResponse.json({ok:false,error:'Already submitted'},{status:409});
    const version=(await repo.listExamVersions()).find(v=>v.id===s.examVersionId);
    if(!version)return NextResponse.json({ok:false,error:'Exam version not found'},{status:404});
    const scored=scoreFrozenExam(version,s); const finalized=finalizeSessionForSubmission(s);
    if(!finalized.ok)return NextResponse.json({ok:false,error:finalized.error},{status:409});
    await repo.saveSession(s);
    return NextResponse.json({ok:true,result:{...scored,submittedAt:s.submittedAt,timedOut:finalized.timedOut}});
  }catch(e){return apiError(e);}
}
