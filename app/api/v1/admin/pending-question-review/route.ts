import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { apiError } from '@/lib/server/http';
import { getRepository } from '@/lib/server/repository';
import { hasPendingQuestionReviewToken } from '@/lib/server/pending-question-review-auth';
import { buildPendingQuestionReviewRecords, pendingReviewDigest, reviewPendingQuestionBatch, summarizePendingQuestionReviews } from '@/lib/server/pending-question-review';

async function authorize(req:Request){if(!hasPendingQuestionReviewToken(req))await requireAuth(req,'admin')}

export async function GET(req:Request){
  try{
    await authorize(req);const repo=getRepository();const records=buildPendingQuestionReviewRecords(await repo.listQuestions(),await repo.listFactoryJobs());
    return NextResponse.json({ok:true,summary:summarizePendingQuestionReviews(records),digest:pendingReviewDigest(records)});
  }catch(error){return apiError(error)}
}

export async function POST(req:Request){
  try{
    await authorize(req);const body=await req.json() as {afterId?:string;limit?:number;apply?:boolean};
    return NextResponse.json({ok:true,...await reviewPendingQuestionBatch(getRepository(),body)});
  }catch(error){return apiError(error)}
}
