import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { apiError } from '@/lib/server/http';
import { renderFactoryCandidateAudio } from '@/lib/server/factory-service';

export async function POST(req:Request,{params}:{params:Promise<{id:string;candidateId:string}>}){
  try{await requireAuth(req,'admin');const {id,candidateId}=await params;const result=await renderFactoryCandidateAudio(id,candidateId);return NextResponse.json({ok:true,...result});}
  catch(e){return apiError(e);}
}
