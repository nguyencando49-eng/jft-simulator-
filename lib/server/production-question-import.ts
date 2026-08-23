import { seedQuestions } from '@/data/admin/seed';
import type { QuestionRecord } from '@/lib/admin-types';
import type { Repository } from './domain';
import { runQuestionQa } from './qa';

export const PRODUCTION_QUESTION_BATCH = 'JFT-2100-V1';

export function buildProductionReviewQuestions(now = new Date().toISOString()):QuestionRecord[] {
  const questions = seedQuestions.map((question) => ({
    ...question,
    status: 'review' as const,
    tags: Array.from(new Set([
      ...question.tags,
      `production-batch:${PRODUCTION_QUESTION_BATCH}`,
      'qa-state:human-review-required',
    ])),
    updatedAt: now,
  }));
  if (questions.length !== 2100) throw new Error(`Expected 2,100 questions, received ${questions.length}.`);
  const invalid = questions.find((question) => !runQuestionQa(question).passed);
  if (invalid) throw new Error(`Q0 rejected ${invalid.id}.`);
  return questions;
}

export async function importProductionQuestionBank(repository:Repository){
  const existing=new Map((await repository.listQuestions()).map(question=>[question.id,question]));
  const questions = buildProductionReviewQuestions().map(question=>{
    const saved=existing.get(question.id);
    return saved?.status==='approved'||saved?.status==='archived'?saved:question;
  });
  await repository.upsertQuestions(questions);
  const status=questions.reduce<Record<string,number>>((counts,question)=>{
    counts[question.status]=(counts[question.status]??0)+1;
    return counts;
  },{});
  return {
    batch: PRODUCTION_QUESTION_BATCH,
    imported: questions.length,
    status,
    byLevel: Object.fromEntries(['A1','A2.1','A2.2'].map(level=>[
      level,
      questions.filter(question=>question.level===level).length,
    ])),
  };
}
