import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { apiError } from '@/lib/server/http';
import { getRepository } from '@/lib/server/repository';
import { A1MvpReleaseError, buildA1MvpReleasePack, previewApprovedAuthoredSeed, publishA1MvpReleasePack, syncApprovedAuthoredSeed } from '@/lib/server/a1-mvp-release';
import { hasProductionImportToken } from '@/lib/server/production-import-auth';

async function requireReleaseAuthorization(req:Request){
  if(!hasProductionImportToken(req))await requireAuth(req,'admin');
}

export async function GET(req:Request){
  try{
    await requireReleaseAuthorization(req);
    const repo=getRepository();
    const currentBank=await repo.listQuestions();
    const pack=buildA1MvpReleasePack(previewApprovedAuthoredSeed(currentBank));
    const existing=new Set((await repo.listExamVersions()).map(version=>version.id));
    return NextResponse.json({ok:true,ready:true,report:pack.report,publishedVersionIds:pack.versions.filter(version=>existing.has(version.id)).map(version=>version.id),seedPromotionRequired:currentBank.filter(question=>question.status!=='approved'&&question.status!=='archived'&&pack.report.exams.some(exam=>exam.questionIds.includes(question.id))).map(question=>question.id)});
  }catch(error){
    if(error instanceof A1MvpReleaseError)return NextResponse.json({ok:false,ready:false,error:error.code,message:error.message},{status:422});
    return apiError(error);
  }
}

export async function POST(req:Request){
  try{
    await requireReleaseAuthorization(req);
    const repo=getRepository();
    const seedSync=await syncApprovedAuthoredSeed(repo);
    const result=await publishA1MvpReleasePack(repo);
    return NextResponse.json({ok:true,seedSync,...result},{status:result.published.length?201:200});
  }catch(error){
    if(error instanceof A1MvpReleaseError)return NextResponse.json({ok:false,error:error.code,message:error.message},{status:error.code==='A1_MVP_VERSION_CONFLICT'?409:422});
    return apiError(error);
  }
}
