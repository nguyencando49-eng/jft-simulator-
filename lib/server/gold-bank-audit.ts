import { questions as authoredQuestions } from '@/data/questions';
import type { QuestionRecord } from '@/lib/admin-types';
import type { Question } from '@/lib/types';
import type { Repository } from './domain';
import { runQuestionQa } from './qa';

export const GOLD_BANK_AUDIT_VERSION = 'JFT_GOLD_BANK_50_AUDIT_2026_08_23';
export const GOLD_BANK_REVISED_IDS = [
  'SV-001','SV-002','SV-003','SV-004','SV-005','SV-006','SV-007','SV-011','SV-012',
  'CE-004','CE-006','CE-007','CE-009','CE-010','CE-011',
] as const;

export const GOLD_BANK_LEVEL_REVIEW_IDS = [
  'CE-002','RE-002','SV-009','SV-010','LI-009','LI-010','LI-011','RE-009','RE-010','RE-011',
] as const;
export const GOLD_BANK_AUDIO_HOLD_IDS = ['LI-002'] as const;

const authoredById = new Map(authoredQuestions.map(question => [question.id, question]));

function content(question: Question | QuestionRecord) {
  return {
    id:question.id,section:question.section,type:question.type,level:question.level,
    instruction:question.instruction,prompt:question.prompt,choices:question.choices,
    answer:question.answer,explanationVi:question.explanationVi,audioSrc:question.audioSrc,
    tags:question.tags,
  };
}

function sameContent(left: Question | QuestionRecord, right: Question | QuestionRecord) {
  return JSON.stringify(content(left)) === JSON.stringify(content(right));
}

export function previewGoldBankAudit(bank: QuestionRecord[], now = new Date().toISOString()) {
  const currentById = new Map(bank.map(question => [question.id, question]));
  const changed:QuestionRecord[]=[];
  const held:QuestionRecord[]=[];
  const unchanged:string[]=[];
  for (const id of GOLD_BANK_REVISED_IDS) {
    const current=currentById.get(id),desired=authoredById.get(id);
    if(!current)throw new Error(`Gold Bank question ${id} is missing from the repository.`);
    if(!desired)throw new Error(`Gold Bank source question ${id} is missing.`);
    if(sameContent(current,desired)){unchanged.push(id);continue;}
    const next:QuestionRecord={...structuredClone(desired),version:current.version+1,status:current.status,source:current.source,createdAt:current.createdAt,updatedAt:now};
    if(!runQuestionQa(next).passed)throw new Error(`Gold Bank question ${id} failed deterministic integrity QA.`);
    changed.push(next);
  }
  for(const id of GOLD_BANK_AUDIO_HOLD_IDS){
    const current=currentById.get(id);
    if(!current)throw new Error(`Gold Bank question ${id} is missing from the repository.`);
    if(current.status==='review')continue;
    held.push({...structuredClone(current),status:'review',updatedAt:now});
  }
  return {auditVersion:GOLD_BANK_AUDIT_VERSION,changed,unchanged,held};
}

export async function applyGoldBankAudit(repo:Repository,now=new Date().toISOString()){
  const preview=previewGoldBankAudit(await repo.listQuestions(),now);
  const updates=[...preview.changed,...preview.held];
  if(updates.length)await repo.upsertQuestions(updates);
  return {auditVersion:preview.auditVersion,changed:preview.changed.map(question=>({id:question.id,version:question.version,status:question.status})),held:preview.held.map(question=>({id:question.id,version:question.version,status:question.status})),unchanged:preview.unchanged};
}
