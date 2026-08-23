import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { apiError } from '@/lib/server/http';
import { getRepository } from '@/lib/server/repository';
import { hasPendingQuestionReviewToken } from '@/lib/server/pending-question-review-auth';
import { auditPendingQuestionReviewState, buildPendingQuestionReviewRecords, pendingReviewDigest, reviewPendingQuestionBatch, summarizePendingQuestionReviews } from '@/lib/server/pending-question-review';

async function authorize(req:Request){if(!hasPendingQuestionReviewToken(req))await requireAuth(req,'admin')}

export async function GET(req:Request){
  try{
    await authorize(req);const repo=getRepository(),questions=await repo.listQuestions(),jobs=await repo.listFactoryJobs();const records=buildPendingQuestionReviewRecords(questions,jobs);
    return NextResponse.json({ok:true,summary:summarizePendingQuestionReviews(records),digest:pendingReviewDigest(records),audit:auditPendingQuestionReviewState(questions,jobs)});
  }catch(error){return apiError(error)}
}

export async function POST(req:Request){
  try{
    await authorize(req);const body=await req.json() as {afterId?:string;limit?:number;apply?:boolean};
    return NextResponse.json({ok:true,...await reviewPendingQuestionBatch(getRepository(),body)});
  }catch(error){return apiError(error)}
}
