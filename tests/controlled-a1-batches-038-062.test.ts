import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

type ControlledBatchArtifact = {
  artifactVersion: string;
  runMode: string;
  frozenBeforeHumanReview: boolean;
  manualPreEvaluationEdits: number;
  records: Array<{
    question: { id: string; section: string; status: string };
    preflight: { passed: boolean };
    qa: Record<string, unknown>;
    humanReview: { decision: string | null };
  }>;
  summary: {
    generated: number;
    preflightPass: number;
    humanReviewStatus: string;
  };
};

const readBatch = (batchNumber: number): ControlledBatchArtifact => {
  const batch = String(batchNumber).padStart(3, '0');
  const path = join(
    process.cwd(),
    'data',
    'production',
    `controlled-a1-batch-${batch}.json`,
  );
  return JSON.parse(readFileSync(path, 'utf8')) as ControlledBatchArtifact;
};

describe('Controlled A1 batches 038 through 062', () => {
  it('keeps all 500 fresh candidates frozen for review with complete QA evidence', () => {
    const newIds = new Set<string>();
    const sectionCounts = new Map<string, number>();

    for (let batchNumber = 38; batchNumber <= 62; batchNumber += 1) {
      const batch = String(batchNumber).padStart(3, '0');
      const artifact = readBatch(batchNumber);

      expect(artifact.artifactVersion).toBe(`CONTROLLED_A1_BATCH_${batch}_V1`);
      expect(artifact.runMode).toBe(`scale-${batch}`);
      expect(artifact.frozenBeforeHumanReview).toBe(true);
      expect(artifact.manualPreEvaluationEdits).toBe(0);
      expect(artifact.records, `batch ${batch}`).toHaveLength(20);
      expect(artifact.summary).toMatchObject({
        generated: 20,
        preflightPass: 20,
        humanReviewStatus: 'PENDING',
      });

      for (const record of artifact.records) {
        expect(record.preflight.passed).toBe(true);
        expect(record.question.status).toBe('review');
        expect(record.humanReview.decision).toBeNull();
        expect(Object.keys(record.qa).sort()).toEqual([
          'qa1',
          'qa2',
          'qa3',
          'qa4',
          'qa5',
          'qa6',
          'qa7',
        ]);
        expect(newIds.has(record.question.id), record.question.id).toBe(false);
        newIds.add(record.question.id);
        sectionCounts.set(
          record.question.section,
          (sectionCounts.get(record.question.section) ?? 0) + 1,
        );
      }
    }

    expect(newIds.size).toBe(500);
    expect(Object.fromEntries(sectionCounts)).toEqual({
      script_vocabulary: 125,
      conversation_expression: 125,
      listening: 125,
      reading: 125,
    });
  });

  it('does not collide with pilot or batches 001 through 037', () => {
    const historicalIds = new Set<string>();
    const pilot = JSON.parse(
      readFileSync(
        join(process.cwd(), 'data', 'pilots', 'generator-recovery-a1-pilot.json'),
        'utf8',
      ),
    ) as ControlledBatchArtifact;

    for (const record of pilot.records) historicalIds.add(record.question.id);
    for (let batchNumber = 1; batchNumber <= 37; batchNumber += 1) {
      for (const record of readBatch(batchNumber).records) historicalIds.add(record.question.id);
    }

    for (let batchNumber = 38; batchNumber <= 62; batchNumber += 1) {
      for (const record of readBatch(batchNumber).records) {
        expect(historicalIds.has(record.question.id), record.question.id).toBe(false);
      }
    }
  });
});
