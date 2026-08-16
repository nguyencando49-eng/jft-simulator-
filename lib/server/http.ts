import { NextResponse } from 'next/server';
export function apiError(error:unknown){ const msg=error instanceof Error?error.message:'Unknown error'; const status=msg==='UNAUTHORIZED'?401:msg==='FORBIDDEN'?403:msg==='AUTH_NOT_CONFIGURED'?500:400; return NextResponse.json({ok:false,error:msg},{status}); }
