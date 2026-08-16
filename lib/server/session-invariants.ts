import type { ExamVersion } from '@/lib/admin-types';
import type { CandidateSessionRecord, UserRole } from './domain';

export type SessionMutation = { questionId?: string; choice?: number; currentIndex?: number };
export function canAccessSession(session:CandidateSessionRecord,userId:string,role:UserRole){
  return !session.candidateId || session.candidateId===userId || role==='admin';
}

export type SessionInvariantResult = { ok: true } | { ok: false; status: number; error: string };

export function isSessionExpired(session: CandidateSessionRecord, now = Date.now()) {
  return now >= new Date(session.expiresAt).getTime();
}

export function expireSessionIfNeeded(session: CandidateSessionRecord, now = Date.now()) {
  if (session.status === 'active' && isSessionExpired(session, now)) session.status = 'expired';
  return session.status === 'expired';
}

export function finalizeSessionForSubmission(session: CandidateSessionRecord, now = Date.now()) {
  if (session.status === 'submitted') return { ok:false as const, error:'Already submitted' };
  const timedOut = session.status === 'expired' || isSessionExpired(session, now);
  session.status = 'submitted';
  session.submittedAt = timedOut ? session.expiresAt : new Date(now).toISOString();
  return { ok:true as const, timedOut, submittedAt:session.submittedAt };
}

export function validateSessionMutation(
  version: ExamVersion,
  session: CandidateSessionRecord,
  mutation: SessionMutation,
): SessionInvariantResult {
  const total = version.questions.length;
  if (!Number.isInteger(session.currentIndex) || session.currentIndex < 0 || session.currentIndex >= Math.max(total, 1)) {
    return { ok: false, status: 409, error: 'Session currentIndex is invalid' };
  }

  if (mutation.currentIndex !== undefined) {
    if (!Number.isInteger(mutation.currentIndex) || mutation.currentIndex < 0 || mutation.currentIndex >= total) {
      return { ok: false, status: 422, error: 'currentIndex is outside exam range' };
    }
    if (mutation.currentIndex < session.currentIndex) {
      const current = version.questions[session.currentIndex];
      const rule = version.rules?.find(r => r.section === current?.snapshot.section);
      if (rule && !rule.allowBack) return { ok: false, status: 409, error: 'Back navigation is disabled for this section' };
    }
  }

  if (mutation.questionId !== undefined) {
    if (!Number.isInteger(mutation.choice)) return { ok: false, status: 422, error: 'Invalid answer' };
    const index = version.questions.findIndex(q => q.questionId === mutation.questionId);
    if (index < 0) return { ok: false, status: 422, error: 'Question does not belong to this exam version' };
    const frozen = version.questions[index];
    if (mutation.choice! < 0 || mutation.choice! >= frozen.snapshot.choices.length) {
      return { ok: false, status: 422, error: 'Choice is outside question choices' };
    }
    const rule = version.rules?.find(r => r.section === frozen.snapshot.section);
    if (rule && !rule.allowBack && index < session.currentIndex) {
      return { ok: false, status: 409, error: 'Answer can no longer be changed for this section' };
    }
    const effectiveIndex = mutation.currentIndex ?? session.currentIndex;
    if (index > effectiveIndex) {
      return { ok: false, status: 409, error: 'Cannot answer a future question before navigating to it' };
    }
  }

  return { ok: true };
}
