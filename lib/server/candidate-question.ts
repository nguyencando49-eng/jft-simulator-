import type {QuestionRecord} from '@/lib/admin-types';

/** Explicit allowlist prevents current or future internal QA evidence from reaching active exams. */
export function toCandidateQuestion(question:QuestionRecord){
  return {id:question.id,section:question.section,type:question.type,level:question.level,instruction:question.instruction,prompt:question.prompt,choices:[...question.choices],audioSrc:question.audioSrc,tags:[...question.tags],version:question.version,status:question.status,source:question.source,createdAt:question.createdAt,updatedAt:question.updatedAt};
}
