import type { ExamVersion } from '@/lib/admin-types';
import type { CandidateSessionRecord, UserRole } from './domain';

export type SessionMutation = { questionId?: string; choice?: number; currentIndex?: number };
export function canAccessSession(session:CandidateSessionRecord,userId:string,role:UserRole){
  return role==='admin' || (!!session.candidateId && session.candidateId===userId);
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

  const currentSection = version.questions[session.currentIndex]?.snapshot.section;
  const allowBack = (section: typeof currentSection) =>
    version.rules?.find(rule => rule.section === section)?.allowBack ?? section !== 'listening';

  if (mutation.currentIndex !== undefined) {
    if (!Number.isInteger(mutation.currentIndex) || mutation.currentIndex < 0 || mutation.currentIndex >= total) {
      return { ok: false, status: 422, error: 'currentIndex is outside exam range' };
    }
    const targetSection = version.questions[mutation.currentIndex].snapshot.section;
    if (targetSection !== currentSection && mutation.currentIndex !== session.currentIndex + 1)
      return { ok: false, status: 409, error: 'Sections must be completed in order; previous sections are closed' };
    if (!allowBack(currentSection) && mutation.currentIndex !== session.currentIndex && mutation.currentIndex !== session.currentIndex + 1)
      return { ok: false, status: 409, error: 'This section must be completed sequentially' };
  }

  if (mutation.questionId !== undefined) {
    if (!Number.isInteger(mutation.choice)) return { ok: false, status: 422, error: 'Invalid answer' };
    const index = version.questions.findIndex(q => q.questionId === mutation.questionId);
    if (index < 0) return { ok: false, status: 422, error: 'Question does not belong to this exam version' };
    const frozen = version.questions[index];
    if (mutation.choice! < 0 || mutation.choice! >= frozen.snapshot.choices.length) {
      return { ok: false, status: 422, error: 'Choice is outside question choices' };
    }
    const effectiveIndex = mutation.currentIndex ?? session.currentIndex;
    if (frozen.snapshot.section !== version.questions[effectiveIndex]?.snapshot.section)
      return { ok: false, status: 409, error: 'Answers can only be changed in the current section' };
    if (!allowBack(frozen.snapshot.section) && index < effectiveIndex) {
      return { ok: false, status: 409, error: 'Answer can no longer be changed for this section' };
    }
    if (index > effectiveIndex) {
      return { ok: false, status: 409, error: 'Cannot answer a future question before navigating to it' };
    }
  }

  return { ok: true };
}
