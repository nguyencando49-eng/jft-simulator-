import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildControlledA1ReplacementQuestions,
  previewControlledA1Replacement,
} from '@/lib/server/controlled-a1-replacement';
import { runQuestionQa } from '@/lib/server/qa';
import { hasControlledA1ReplacementToken } from '@/lib/server/controlled-a1-replacement-auth';

describe('controlled A1 1320-question replacement release', () => {
  it('builds exactly 1320 pending A1 questions with valid static Listening audio', () => {
    const questions = buildControlledA1ReplacementQuestions('2026-08-26T12:00:00.000Z');
    expect(questions).toHaveLength(1320);
    expect(new Set(questions.map((question) => question.id)).size).toBe(1320);
    expect(questions.every((question) => question.level === 'A1' && question.status === 'review')).toBe(true);
    expect(questions.every((question) => runQuestionQa(question).passed)).toBe(true);
    const listening = questions.filter((question) => question.section === 'listening');
    expect(listening).toHaveLength(330);
    for (const question of listening) {
      const path = join(process.cwd(), 'public', question.audioSrc!.replace(/^\//, ''));
      const header = readFileSync(path).subarray(0, 3);
      expect(
        header.toString('ascii') === 'ID3' || (header[0] === 0xff && (header[1] & 0xe0) === 0xe0),
      ).toBe(true);
      expect(statSync(path).size).toBeGreaterThan(1000);
    }
  });

  it('previews a recoverable archive-and-replace operation', () => {
    const old = buildControlledA1ReplacementQuestions().slice(0, 2).map((question, index) => ({
      ...question,
      id: `OLD-${index}`,
      status: 'approved' as const,
    }));
    expect(previewControlledA1Replacement(old)).toMatchObject({
      existing: 2,
      willArchive: 2,
      willUpsert: 1320,
      byLevel: { A1: 1320, 'A2.1': 0, 'A2.2': 0 },
      listeningAudio: 330,
    });
  });

  it('accepts only the exact one-time replacement token', () => {
    process.env.CONTROLLED_A1_REPLACEMENT_TOKEN = 'release-secret';
    expect(hasControlledA1ReplacementToken(new Request('https://test', { headers: { 'x-controlled-a1-replacement-token': 'release-secret' } }))).toBe(true);
    expect(hasControlledA1ReplacementToken(new Request('https://test', { headers: { 'x-controlled-a1-replacement-token': 'wrong' } }))).toBe(false);
    delete process.env.CONTROLLED_A1_REPLACEMENT_TOKEN;
  });
});
