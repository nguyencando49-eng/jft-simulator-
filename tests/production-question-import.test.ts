import { describe,expect,it } from 'vitest';
import { buildProductionReleaseQuestions,PRODUCTION_QUESTION_BATCH } from '@/lib/server/production-question-import';
import { PRODUCTION_BANK_RELEASE_VERSION } from '@/lib/server/production-bank-release';
import { runQuestionQa } from '@/lib/server/qa';

describe('production Question Bank import',()=>{
  it('builds the audited 3,000-question controlled release',()=>{
    const questions=buildProductionReleaseQuestions('2026-09-21T00:00:00.000Z');
    expect(PRODUCTION_QUESTION_BATCH).toBe('JFT-3000-V2');
    expect(questions).toHaveLength(3000);
    expect(new Set(questions.map(question=>question.id)).size).toBe(3000);
    expect(questions.every(question=>question.status==='approved')).toBe(true);
    expect(questions.every(question=>question.tags.includes(`production-batch:${PRODUCTION_QUESTION_BATCH}`))).toBe(true);
    expect(questions.every(question=>question.tags.includes(`release:${PRODUCTION_BANK_RELEASE_VERSION}`))).toBe(true);
    expect(questions.every(question=>question.tags.includes('qa-state:controlled-release-approved'))).toBe(true);
    expect(questions.every(question=>runQuestionQa(question).passed)).toBe(true);
    for(const level of ['A1','A2.1','A2.2'])expect(questions.filter(question=>question.level===level)).toHaveLength(1000);
  });
});
