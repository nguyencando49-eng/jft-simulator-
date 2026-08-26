import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { getRepository } from '@/lib/server/repository';
import { apiError } from '@/lib/server/http';
import {
  applyControlledA1Replacement,
  previewControlledA1Replacement,
  rollbackControlledA1Replacement,
} from '@/lib/server/controlled-a1-replacement';
import { hasControlledA1ReplacementToken } from '@/lib/server/controlled-a1-replacement-auth';

export const maxDuration = 60;

async function authorize(req: Request) {
  if (!hasControlledA1ReplacementToken(req)) await requireAuth(req, 'admin');
}

export async function GET(req: Request) {
  try {
    await authorize(req);
    const repository = getRepository();
    return NextResponse.json({ ok: true, preview: previewControlledA1Replacement(await repository.listQuestions()) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(req: Request) {
  try {
    await authorize(req);
    const body = (await req.json()) as { action?: string; confirmation?: string };
    if (body.action === 'rollback') {
      if (body.confirmation !== 'ROLLBACK_CONTROLLED_A1_500') {
        return NextResponse.json({ ok: false, error: 'ROLLBACK_CONFIRMATION_REQUIRED' }, { status: 422 });
      }
      return NextResponse.json({ ok: true, result: await rollbackControlledA1Replacement(getRepository()) });
    }
    if (body.action !== 'apply' || body.confirmation !== 'ARCHIVE_2100_IMPORT_500_PENDING') {
      return NextResponse.json({ ok: false, error: 'REPLACEMENT_CONFIRMATION_REQUIRED' }, { status: 422 });
    }
    return NextResponse.json({ ok: true, result: await applyControlledA1Replacement(getRepository()) });
  } catch (error) {
    return apiError(error);
  }
}
