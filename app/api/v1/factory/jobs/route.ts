import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { apiError } from '@/lib/server/http';
import { getRepository } from '@/lib/server/repository';
import { FactoryJob, FactoryRequest } from '@/lib/server/factory-domain';
import { factoryProviderMode } from '@/lib/server/factory-provider';
import { runFactoryJob, validateFactoryRequest } from '@/lib/server/factory-service';

export async function GET(req:Request){
  try{ await requireAuth(req,'admin'); const jobs=await getRepository().listFactoryJobs(); return NextResponse.json({ok:true,jobs,provider:factoryProviderMode()}); }
  catch(e){ return apiError(e); }
}
export async function POST(req:Request){
  try{
    const user=await requireAuth(req,'admin'); const input=await req.json() as FactoryRequest; validateFactoryRequest(input);
    const now=new Date().toISOString();
    const job:FactoryJob={id:crypto.randomUUID(),requestedBy:user.userId,status:'queued',request:input,provider:factoryProviderMode(),createdAt:now,updatedAt:now,candidates:[]};
    await getRepository().saveFactoryJob(job);
    const finished=await runFactoryJob(job);
    return NextResponse.json({ok:finished.status!=='failed',job:finished},{status:finished.status==='failed'?502:201});
  }catch(e){ return apiError(e); }
}
