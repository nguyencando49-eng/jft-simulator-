import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { apiError } from '@/lib/server/http';
import { getRepository } from '@/lib/server/repository';
import { latestPublishedVersions, toCandidateExamSummary } from '@/lib/server/candidate-exam';

export async function GET(req:Request){
  try{
    await requireAuth(req,'candidate');
    const published=latestPublishedVersions(await getRepository().listExamVersions()).map(toCandidateExamSummary);
    return NextResponse.json({ok:true,versions:published,version:published[0]??null});
  }catch(e){return apiError(e);}
}
