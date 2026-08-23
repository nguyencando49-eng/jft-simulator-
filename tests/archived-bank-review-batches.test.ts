import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { seedQuestions } from '@/data/admin/seed';
import pendingReview from '@/data/reviews/pending-question-review-2026-08-23.json';

const levelOrder: Record<string, number> = { A1: 0, 'A2.1': 1, 'A2.2': 2 };
const sectionOrder: Record<string, number> = { script_vocabulary: 0, conversation_expression: 1, listening: 2, reading: 3 };
const queue = pendingReview.records.filter(record => record.decision === 'REJECT').sort((left, right) =>
  levelOrder[left.level] - levelOrder[right.level]
  || sectionOrder[left.section] - sectionOrder[right.section]
  || left.questionId.localeCompare(right.questionId),
);
const directory = join(process.cwd(), 'data', 'reviews', 'archived-bank');
const batches = readdirSync(directory).filter(file => /^ARCHIVE-BATCH-\d{3}-DECISIONS\.json$/.test(file)).sort().map(file => JSON.parse(readFileSync(join(directory, file), 'utf8')) as {
  records: Array<Record<string, unknown> & { questionId: string; decision: string; issues: string[]; reviewReason: string; audioVerified: boolean | null }>;
});

describe('archived-bank controlled review batches', () => {
  it('forms one contiguous, duplicate-free prefix of the signed archived queue', () => {
    const ids = batches.flatMap(batch => batch.records.map(record => record.questionId));
    expect(ids).toEqual(queue.slice(0, ids.length).map(record => record.questionId));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses at most 50 records per batch', () => {
    expect(batches.length).toBeGreaterThan(0);
    for (const batch of batches) expect(batch.records.length).toBeLessThanOrEqual(50);
  });

  it('keeps a complete explicit decision for every reviewed item', () => {
    const required = ['batchId', 'decision', 'confidence', 'currentStatus', 'section', 'currentLevel', 'recommendedLevel', 'answerValid', 'answerUnique', 'japaneseNatural', 'distractorsAcceptable', 'sectionAligned', 'levelAligned', 'metadataAligned', 'explanationAligned', 'audioVerified', 'issues', 'before', 'after', 'reviewReason', 'remainingHumanCheck'];
    for (const record of batches.flatMap(batch => batch.records)) {
      for (const key of required) expect(Object.hasOwn(record, key), `${record.questionId}:${key}`).toBe(true);
      expect(['KEEP', 'REVISE', 'REVIEW_LEVEL', 'HOLD_AUDIO', 'REMOVE']).toContain(record.decision);
      expect(record.reviewReason.trim().length, record.questionId).toBeGreaterThan(30);
      expect(record.audioVerified).toBeNull();
    }
  });

  it('does not restore mass-template questions', () => {
    for (const record of batches.flatMap(batch => batch.records).filter(record => record.questionId.startsWith('PROD-'))) {
      expect(record.decision, record.questionId).toBe('REMOVE');
      expect(record.issues, record.questionId).toEqual(expect.arrayContaining(['CAN_DO_MISMATCH', 'DISTRACTOR_QUALITY', 'DUPLICATE_RISK']));
    }
  });

  it('preserves source questions and valid answer indexes', () => {
    const byId = new Map(seedQuestions.map(question => [question.id, question]));
    for (const record of batches.flatMap(batch => batch.records)) {
      const question = byId.get(record.questionId);
      expect(question, record.questionId).toBeTruthy();
      expect(question!.answer, record.questionId).toBeGreaterThanOrEqual(0);
      expect(question!.answer, record.questionId).toBeLessThan(question!.choices.length);
    }
  });
});
