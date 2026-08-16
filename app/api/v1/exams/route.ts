import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { apiError } from '@/lib/server/http';
import { getRepository } from '@/lib/server/repository';
import { generateExamVersion } from '@/lib/exam-generator';
import { ExamDraft } from '@/lib/admin-types';
export async function GET(req:Request){ try{ await requireAuth(req,'admin'); const id=new URL(req.url).searchParams.get('id')??'JFT-MOCK-001'; const repo=getRepository(); return NextResponse.json({ok:true,draft:await repo.getExamDraft(id),versions:await repo.listExamVersions(id)}); }catch(e){return apiError(e);} }
export async function PUT(req:Request){ try{ await requireAuth(req,'admin'); const draft=await req.json() as ExamDraft; const saved=await getRepository().saveExamDraft(draft); return NextResponse.json({ok:true,draft:saved}); }catch(e){return apiError(e);} }
export async function POST(req:Request){ try{ await requireAuth(req,'admin'); const {examId}=await req.json() as {examId:string}; const repo=getRepository(); const draft=await repo.getExamDraft(examId); if(!draft)return NextResponse.json({ok:false,error:'Exam draft not found'},{status:404}); const bank=await repo.listQuestions(); const versions=await repo.listExamVersions(examId); const generated=generateExamVersion(draft,bank,Math.max(0,...versions.map(v=>v.version))+1); if(!generated.ok)return NextResponse.json(generated,{status:422}); await repo.saveExamVersion(generated.version); return NextResponse.json({ok:true,version:generated.version},{status:201}); }catch(e){return apiError(e);} }
