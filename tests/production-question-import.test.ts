import { describe,expect,it } from 'vitest';
import { buildProductionReviewQuestions,PRODUCTION_QUESTION_BATCH } from '@/lib/server/production-question-import';
import { runQuestionQa } from '@/lib/server/qa';

describe('production Question Bank import',()=>{
  it('builds 2,100 structurally valid questions that all require human review',()=>{
    const questions=buildProductionReviewQuestions('2026-08-23T00:00:00.000Z');
    expect(questions).toHaveLength(2100);
    expect(new Set(questions.map(question=>question.id)).size).toBe(2100);
    expect(questions.every(question=>question.status==='review')).toBe(true);
    expect(questions.every(question=>question.tags.includes(`production-batch:${PRODUCTION_QUESTION_BATCH}`))).toBe(true);
    expect(questions.every(question=>question.tags.includes('qa-state:human-review-required'))).toBe(true);
    expect(questions.every(question=>runQuestionQa(question).passed)).toBe(true);
    for(const level of ['A1','A2.1','A2.2'])expect(questions.filter(question=>question.level===level)).toHaveLength(700);
  });
});
