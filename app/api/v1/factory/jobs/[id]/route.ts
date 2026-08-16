import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { apiError } from '@/lib/server/http';
import { getRepository } from '@/lib/server/repository';
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){try{await requireAuth(req,'admin');const {id}=await params;const job=await getRepository().getFactoryJob(id);if(!job)return NextResponse.json({ok:false,error:'Not found'},{status:404});return NextResponse.json({ok:true,job});}catch(e){return apiError(e);}}
