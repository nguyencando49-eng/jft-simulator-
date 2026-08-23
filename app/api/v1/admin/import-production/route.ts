import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { apiError } from '@/lib/server/http';
import { getRepository } from '@/lib/server/repository';
import { importProductionQuestionBank } from '@/lib/server/production-question-import';

export const maxDuration = 60;

export async function POST(req:Request){
  try{
    await requireAuth(req,'admin');
    const result=await importProductionQuestionBank(getRepository());
    return NextResponse.json({ok:true,...result},{status:201});
  }catch(error){return apiError(error);}
}
