import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

type ControlledBatchArtifact = {
  records: Array<{
    question: { status: string };
    humanReview: { decision: string | null; reviewer?: string };
  }>;
  summary: {
    generated: number;
    humanGold: number | null;
    humanReviewStatus: string;
    humanGoldYield: number | null;
  };
};

describe('Controlled A1 approval through batch 037', () => {
  it('records the repository owner approval without auto-approving the Question Bank', () => {
    let approvedItems = 0;

    for (let batchNumber = 1; batchNumber <= 37; batchNumber += 1) {
      const batch = String(batchNumber).padStart(3, '0');
      const artifactPath = join(
        process.cwd(),
        'data',
        'production',
        `controlled-a1-batch-${batch}.json`,
      );
      const artifact = JSON.parse(
        readFileSync(artifactPath, 'utf8'),
      ) as ControlledBatchArtifact;

      expect(artifact.records, `batch ${batch}`).toHaveLength(20);
      expect(artifact.records.every((record) => record.humanReview.decision === 'GOLD')).toBe(true);
      expect(artifact.records.every((record) => record.humanReview.reviewer === 'repository-owner')).toBe(true);
      expect(artifact.records.every((record) => record.question.status === 'review')).toBe(true);
      expect(artifact.summary).toMatchObject({
        generated: 20,
        humanGold: 20,
        humanReviewStatus: 'COMPLETED',
        humanGoldYield: 1,
      });

      approvedItems += artifact.records.length;
    }

    expect(approvedItems).toBe(740);
  });
});
