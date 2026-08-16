import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { apiError } from '@/lib/server/http';
import { approveFactoryCandidates } from '@/lib/server/factory-service';
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){try{await requireAuth(req,'admin');const {id}=await params;const body=await req.json() as {candidateIds?:string[]};const result=await approveFactoryCandidates(id,body.candidateIds||[]);return NextResponse.json({ok:true,...result});}catch(e){return apiError(e);}}
