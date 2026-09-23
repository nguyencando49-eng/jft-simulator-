import { seedQuestions } from '@/data/admin/seed';
import type { QuestionRecord } from '@/lib/admin-types';
import type { Repository } from './domain';
import { runQuestionQa } from './qa';
import { assertControlledProductionBank,PRODUCTION_BANK_RELEASE_VERSION } from './production-bank-release';

export const PRODUCTION_QUESTION_BATCH = 'JFT-3000-V3';

export function buildProductionReleaseQuestions(now = new Date().toISOString()):QuestionRecord[] {
  assertControlledProductionBank();
  const questions = seedQuestions.map((question) => ({
    ...question,
    status: 'approved' as const,
    tags: Array.from(new Set([
      ...question.tags.filter(tag=>!tag.startsWith('production-batch:')&&!tag.startsWith('qa-state:')),
      `production-batch:${PRODUCTION_QUESTION_BATCH}`,
      `release:${PRODUCTION_BANK_RELEASE_VERSION}`,
      'qa-state:controlled-release-approved',
    ])),
    updatedAt: now,
  }));
  if (questions.length !== 3000) throw new Error(`Expected 3,000 questions, received ${questions.length}.`);
  const invalid = questions.find((question) => !runQuestionQa(question).passed);
  if (invalid) throw new Error(`Q0 rejected ${invalid.id}.`);
  return questions;
}

/** Compatibility alias retained for admin/report tooling created before the controlled release. */
export const buildProductionReviewQuestions=buildProductionReleaseQuestions;

export async function importProductionQuestionBank(repository:Repository){
  const existing=new Map((await repository.listQuestions()).map(question=>[question.id,question]));
  const questions = buildProductionReleaseQuestions().map(question=>{
    const saved=existing.get(question.id);
    if(saved?.status==='archived')return saved;
    if(!saved)return question;
    const changed=JSON.stringify({...saved,version:0,createdAt:'',updatedAt:'',status:'approved'})!==JSON.stringify({...question,version:0,createdAt:'',updatedAt:'',status:'approved'});
    return {...question,version:changed?Math.max(question.version,saved.version+1):Math.max(question.version,saved.version),createdAt:saved.createdAt};
  });
  await repository.upsertQuestions(questions);
  const status=questions.reduce<Record<string,number>>((counts,question)=>{
    counts[question.status]=(counts[question.status]??0)+1;
    return counts;
  },{});
  return {
    batch: PRODUCTION_QUESTION_BATCH,
    release:PRODUCTION_BANK_RELEASE_VERSION,
    imported: questions.length,
    status,
    byLevel: Object.fromEntries(['A1','A2.1','A2.2'].map(level=>[
      level,
      questions.filter(question=>question.level===level).length,
    ])),
  };
}
