import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { apiError } from '@/lib/server/http';
import { getRepository } from '@/lib/server/repository';
import { scoreFrozenExam } from '@/lib/server/server-scoring';
export async function GET(req:Request){try{await requireAuth(req,'admin');const repo=getRepository();const sessions=await repo.listSessions();const versions=await repo.listExamVersions();const attempts=sessions.map(s=>{const v=versions.find(x=>x.id===s.examVersionId);const scored=v?scoreFrozenExam(v,s):null;return {id:s.id,examVersionId:s.examVersionId,status:s.status,startedAt:s.startedAt,submittedAt:s.submittedAt,answered:scored?.answered??0,total:scored?.total??0,scorePercent:s.status==='submitted'?scored?.scorePercent:undefined};}).sort((a,b)=>b.startedAt.localeCompare(a.startedAt));return NextResponse.json({ok:true,attempts});}catch(e){return apiError(e);}}
