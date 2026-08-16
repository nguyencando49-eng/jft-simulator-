import { NextResponse } from 'next/server';
import { getRepository, repositoryMode } from '@/lib/server/repository';
import { requireAuth } from '@/lib/server/auth';
import { apiError } from '@/lib/server/http';
import { QuestionRecord } from '@/lib/admin-types';
import { runQuestionQa } from '@/lib/server/qa';
export async function GET(req:Request){ try{ await requireAuth(req,'admin'); const questions=await getRepository().listQuestions(); return NextResponse.json({ok:true,mode:repositoryMode(),questions}); }catch(e){return apiError(e);} }
export async function POST(req:Request){ try{ await requireAuth(req,'admin'); const q=await req.json() as QuestionRecord; const qa=runQuestionQa(q); if(!qa.passed) return NextResponse.json({ok:false,qa},{status:422}); q.updatedAt=new Date().toISOString(); const saved=await getRepository().upsertQuestion(q); return NextResponse.json({ok:true,question:saved,qa},{status:201}); }catch(e){return apiError(e);} }
