import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { apiError } from '@/lib/server/http';
import { getRepository } from '@/lib/server/repository';
import { applyGoldBankAudit, previewGoldBankAudit } from '@/lib/server/gold-bank-audit';
import { hasProductionImportToken } from '@/lib/server/production-import-auth';

async function authorize(request:Request){if(!hasProductionImportToken(request))await requireAuth(request,'admin')}

export async function GET(request:Request){
  try{
    await authorize(request);
    const preview=previewGoldBankAudit(await getRepository().listQuestions());
    return NextResponse.json({ok:true,auditVersion:preview.auditVersion,changed:preview.changed.map(question=>({id:question.id,fromVersion:question.version-1,toVersion:question.version,status:question.status})),held:preview.held.map(question=>({id:question.id,version:question.version,fromStatus:'approved',toStatus:question.status})),unchanged:preview.unchanged});
  }catch(error){return apiError(error)}
}

export async function POST(request:Request){
  try{
    await authorize(request);
    return NextResponse.json({ok:true,...await applyGoldBankAudit(getRepository())});
  }catch(error){return apiError(error)}
}
