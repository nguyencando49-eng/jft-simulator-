import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const finalPath = join(process.cwd(), 'data', 'reviews', 'full-bank', 'FINAL-DECISIONS.json');
const final = JSON.parse(readFileSync(finalPath, 'utf8')) as {
  summary: {
    totalReviewed: number;
    decisions: Record<string, number>;
    approvedAfterVerification: number;
    stillUnpublished: number;
  };
  records: Array<{
    questionId: string;
    batchId: string;
    decision: string;
    batchCommit: string;
    exactAction: string;
    finalStatus: string;
  }>;
};

describe('full Question Bank final audit', () => {
  it('reconciles all 973 target records exactly once', () => {
    expect(final.summary.totalReviewed).toBe(973);
    expect(final.records).toHaveLength(973);
    expect(new Set(final.records.map(record => record.questionId)).size).toBe(973);
  });

  it('reconciles the final decision totals', () => {
    expect(final.summary.decisions).toEqual({
      KEEP: 6,
      REVISE: 1,
      REVIEW_LEVEL: 0,
      HOLD_AUDIO: 5,
      REMOVE: 961,
    });
    expect(final.summary.approvedAfterVerification).toBe(0);
    expect(final.summary.stillUnpublished).toBe(973);
  });

  it('preserves batch traceability and does not claim production mutations', () => {
    expect(new Set(final.records.map(record => record.batchId)).size).toBe(20);
    expect(final.records.every(record => /^[0-9a-f]{7}$/.test(record.batchCommit))).toBe(true);
    expect(final.records.every(record => record.finalStatus === 'review')).toBe(true);
    expect(final.records.every(record => record.exactAction.length > 10)).toBe(true);
  });
});
