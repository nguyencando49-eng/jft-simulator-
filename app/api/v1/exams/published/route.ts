import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { apiError } from '@/lib/server/http';
import { getRepository } from '@/lib/server/repository';
export async function GET(req:Request){try{await requireAuth(req,'candidate');const versions=await getRepository().listExamVersions();const v=[...versions].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt))[0];return NextResponse.json({ok:true,version:v?{id:v.id,examId:v.examId,title:v.title,durationMinutes:v.durationMinutes,publishedAt:v.publishedAt}:null});}catch(e){return apiError(e);}}
