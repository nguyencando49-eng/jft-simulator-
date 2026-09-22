import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { apiError } from '@/lib/server/http';
import { getRepository } from '@/lib/server/repository';
import { hasProductionImportToken } from '@/lib/server/production-import-auth';
import { previewProductionRelease,publishProductionRelease,ProductionReleaseError } from '@/lib/server/production-release';

export const maxDuration=60;

async function authorize(req:Request){
  if(!hasProductionImportToken(req))await requireAuth(req,'admin');
}

export async function GET(req:Request){
  try{
    await authorize(req);
    return NextResponse.json({ok:true,...await previewProductionRelease(getRepository())});
  }catch(error){
    if(error instanceof ProductionReleaseError)return NextResponse.json({ok:false,error:error.code,message:error.message},{status:422});
    return apiError(error);
  }
}

export async function POST(req:Request){
  try{
    await authorize(req);
    const result=await publishProductionRelease(getRepository());
    return NextResponse.json({ok:true,...result},{status:result.published.length?201:200});
  }catch(error){
    if(error instanceof ProductionReleaseError)return NextResponse.json({ok:false,error:error.code,message:error.message},{status:error.code==='PRODUCTION_VERSION_CONFLICT'?409:422});
    return apiError(error);
  }
}
