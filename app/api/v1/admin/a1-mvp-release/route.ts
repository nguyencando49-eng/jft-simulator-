import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { apiError } from '@/lib/server/http';
import { getRepository } from '@/lib/server/repository';
import { A1MvpReleaseError, buildA1MvpReleasePack, publishA1MvpReleasePack } from '@/lib/server/a1-mvp-release';

export async function GET(req:Request){
  try{
    await requireAuth(req,'admin');
    const repo=getRepository();
    const pack=buildA1MvpReleasePack(await repo.listQuestions());
    const existing=new Set((await repo.listExamVersions()).map(version=>version.id));
    return NextResponse.json({ok:true,ready:true,report:pack.report,publishedVersionIds:pack.versions.filter(version=>existing.has(version.id)).map(version=>version.id)});
  }catch(error){
    if(error instanceof A1MvpReleaseError)return NextResponse.json({ok:false,ready:false,error:error.code,message:error.message},{status:422});
    return apiError(error);
  }
}

export async function POST(req:Request){
  try{
    await requireAuth(req,'admin');
    const result=await publishA1MvpReleasePack(getRepository());
    return NextResponse.json({ok:true,...result},{status:result.published.length?201:200});
  }catch(error){
    if(error instanceof A1MvpReleaseError)return NextResponse.json({ok:false,error:error.code,message:error.message},{status:error.code==='A1_MVP_VERSION_CONFLICT'?409:422});
    return apiError(error);
  }
}
