import { describe,expect,it,vi } from 'vitest';
import { buildProductionReleaseQuestions,importProductionQuestionBank,PRODUCTION_QUESTION_BATCH } from '@/lib/server/production-question-import';
import type { Repository } from '@/lib/server/domain';
import { PRODUCTION_BANK_RELEASE_VERSION } from '@/lib/server/production-bank-release';
import { runQuestionQa } from '@/lib/server/qa';

describe('production Question Bank import',()=>{
  it('skips unchanged JSONB rows and archived questions, writing only real changes',async()=>{
    const saved=buildProductionReleaseQuestions('2026-09-21T00:00:00.000Z');
    saved[0].prompt+=' outdated';
    saved[1].status='draft';
    saved[2].status='archived';
    const reorder=(value:any):any=>Array.isArray(value)?value.map(reorder):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).reverse().map(([key,item])=>[key,reorder(item)])):value;
    const upsertQuestions=vi.fn(async rows=>rows);
    const repo={listQuestions:async()=>reorder(saved),upsertQuestions} as unknown as Repository;
    const result=await importProductionQuestionBank(repo);
    expect(result.imported).toBe(3000);
    expect(upsertQuestions).toHaveBeenCalledOnce();
    const written=upsertQuestions.mock.calls[0][0];
    expect(written.map((q:any)=>q.id)).toEqual([saved[0].id,saved[1].id]);
    expect(written[0].version).toBe(saved[0].version+1);
    expect(written[1].status).toBe('approved');
  });
  it('builds the audited 3,000-question controlled release',()=>{
    const questions=buildProductionReleaseQuestions('2026-09-21T00:00:00.000Z');
    expect(PRODUCTION_QUESTION_BATCH).toBe('JFT-3000-V3');
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
