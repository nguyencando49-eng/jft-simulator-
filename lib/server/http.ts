import { NextResponse } from 'next/server';
import { SourceFactoryError } from './source-domain';
export function apiError(error:unknown){ const msg=error instanceof Error?error.message:'Unknown error'; const code=error instanceof SourceFactoryError?error.code:undefined; const status=msg==='UNAUTHORIZED'?401:msg==='FORBIDDEN'?403:msg==='AUTH_NOT_CONFIGURED'?500:code==='SOURCE_EMPTY'||code==='INVALID_MODEL_OUTPUT'||code==='KNOWLEDGE_REJECTED'||code==='PLAN_FAILED'?422:code?502:400; return NextResponse.json({ok:false,error:msg,...(code?{code}:{})},{status}); }
