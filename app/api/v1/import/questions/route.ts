import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { apiError } from '@/lib/server/http';
import { getRepository } from '@/lib/server/repository';
import { csvRowsToQuestions, importQuestionRows, parseCsv } from '@/lib/server/importer';
export async function POST(req:Request){ try{ await requireAuth(req,'admin'); const contentType=req.headers.get('content-type')??''; let rows:unknown[]=[]; if(contentType.includes('text/csv')) rows=csvRowsToQuestions(parseCsv(await req.text())); else { const body=await req.json(); rows=Array.isArray(body)?body:(body.questions??[]); } const result=importQuestionRows(rows); const repo=getRepository(); for(const q of result.accepted) await repo.upsertQuestion(q); return NextResponse.json({ok:result.rejected.length===0,...result},{status:result.rejected.length?207:201}); }catch(e){return apiError(e);} }
