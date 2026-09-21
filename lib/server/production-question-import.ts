import { seedQuestions } from '@/data/admin/seed';
import type { QuestionRecord } from '@/lib/admin-types';
import type { Repository } from './domain';
import { runQuestionQa } from './qa';

export const PRODUCTION_QUESTION_BATCH = 'JFT-3000-V2';

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
  if (questions.length !== 3000) throw new Error(`Expected 3,000 questions, received ${questions.length}.`);
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
