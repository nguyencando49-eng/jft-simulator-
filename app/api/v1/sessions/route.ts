import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { apiError } from '@/lib/server/http';
import { getRepository } from '@/lib/server/repository';
import { scoreFrozenExam } from '@/lib/server/server-scoring';
import { e2eSessionDurationMs } from '@/lib/server/e2e';

export async function GET(req:Request){
  try{
    const auth=await requireAuth(req,'candidate'); const repo=getRepository();
    const mine=(await repo.listSessions()).filter(s=>s.candidateId===auth.userId); for(const s of mine){if(s.status==='active'&&Date.now()>=new Date(s.expiresAt).getTime()){s.status='expired';await repo.saveSession(s);}} const sessions=mine.sort((a,b)=>b.startedAt.localeCompare(a.startedAt));
    const versions=await repo.listExamVersions();
    const attempts=sessions.map(s=>{const v=versions.find(x=>x.id===s.examVersionId);const scored=v?scoreFrozenExam(v,s):null;return {id:s.id,examVersionId:s.examVersionId,examTitle:v?.title??s.examVersionId,status:s.status,startedAt:s.startedAt,expiresAt:s.expiresAt,submittedAt:s.submittedAt,currentIndex:s.currentIndex,answered:scored?.answered??0,total:scored?.total??0,scorePercent:s.status==='submitted'?scored?.scorePercent:undefined};});
    return NextResponse.json({ok:true,attempts});
  }catch(e){return apiError(e);}
}

export async function POST(req:Request){
  try{
    const auth=await requireAuth(req,'candidate'); const {examVersionId}=await req.json() as {examVersionId:string}; const repo=getRepository();
    const version=(await repo.listExamVersions()).find(v=>v.id===examVersionId); if(!version)return NextResponse.json({ok:false,error:'Exam version not found'},{status:404});
    const active=(await repo.listSessions()).find(s=>s.candidateId===auth.userId&&s.examVersionId===examVersionId&&s.status==='active'&&Date.now()<new Date(s.expiresAt).getTime());
    if(active){const rules=version.rules?.map(r=>({section:r.section,allowBack:r.allowBack}))??Array.from(new Set(version.questions.map(q=>q.snapshot.section))).map(section=>({section,allowBack:section!=='listening'}));const questions=version.questions.map(f=>{const {answer:_,explanationVi:__,...safe}=f.snapshot;return safe;});return NextResponse.json({ok:true,session:active,exam:{id:version.id,title:version.title,durationMinutes:version.durationMinutes,rules,questions},resumed:true});}
    const now=Date.now(); const session={id:crypto.randomUUID(),examVersionId,candidateId:auth.userId,status:'active' as const,startedAt:new Date(now).toISOString(),expiresAt:new Date(now+e2eSessionDurationMs(req,version.durationMinutes*60000)).toISOString(),currentIndex:0,answers:{}}; await repo.createSession(session);
    const rules=version.rules?.map(r=>({section:r.section,allowBack:r.allowBack}))??Array.from(new Set(version.questions.map(q=>q.snapshot.section))).map(section=>({section,allowBack:section!=='listening'})); const questions=version.questions.map(f=>{const {answer:_,explanationVi:__,...safe}=f.snapshot;return safe;});
    return NextResponse.json({ok:true,session,exam:{id:version.id,title:version.title,durationMinutes:version.durationMinutes,rules,questions}},{status:201});
  }catch(e){return apiError(e);}
}
