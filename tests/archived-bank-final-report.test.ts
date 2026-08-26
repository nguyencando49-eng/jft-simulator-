import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const final = JSON.parse(readFileSync(join(process.cwd(), 'data', 'reviews', 'archived-bank', 'FINAL-ARCHIVED-DECISIONS.json'), 'utf8')) as {
  summary: { totalReviewed: number; decisions: Record<string, number>; restoredOrPublished: number; stillArchived: number };
  records: Array<{ questionId: string; batchId: string; batchCommit: string; decision: string; finalStatus: string; exactAction: string }>;
};

describe('archived Question Bank final audit', () => {
  it('reconciles all 1,077 archived targets exactly once', () => {
    expect(final.summary.totalReviewed).toBe(1077);
    expect(final.records).toHaveLength(1077);
    expect(new Set(final.records.map(record => record.questionId)).size).toBe(1077);
  });

  it('reconciles decisions without restoring content', () => {
    expect(final.summary.decisions).toEqual({ KEEP: 6, REMOVE: 1071 });
    expect(final.summary.restoredOrPublished).toBe(0);
    expect(final.summary.stillArchived).toBe(1077);
    expect(final.records.every(record => record.finalStatus === 'archived')).toBe(true);
  });

  it('preserves traceability across all 22 batches', () => {
    expect(new Set(final.records.map(record => record.batchId)).size).toBe(22);
    expect(final.records.every(record => /^[0-9a-f]{7}$/.test(record.batchCommit))).toBe(true);
    expect(final.records.every(record => record.exactAction.length > 30)).toBe(true);
  });
});
