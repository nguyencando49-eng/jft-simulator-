import type {QuestionRecord} from '@/lib/admin-types';
import type {CandidateSessionRecord} from './domain';

/** Explicit allowlist prevents current or future internal QA evidence from reaching active exams. */
export function toCandidateQuestion(question:QuestionRecord){
  return {
    id:question.id,
    section:question.section,
    type:question.type,
    level:question.level,
    instruction:question.instruction,
    prompt:question.prompt,
    choices:[...question.choices],
    ...(question.audioSrc?{audioSrc:question.audioSrc}:{}),
  };
}

export function toCandidateSession(session:CandidateSessionRecord){
  return {
    id:session.id,
    examVersionId:session.examVersionId,
    status:session.status,
    startedAt:session.startedAt,
    expiresAt:session.expiresAt,
    ...(session.submittedAt?{submittedAt:session.submittedAt}:{}),
    currentIndex:session.currentIndex,
    answers:{...session.answers},
  };
}
