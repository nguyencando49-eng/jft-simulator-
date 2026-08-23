import { describe, expect, it } from 'vitest';
import { formatQuestionPrompt } from '../lib/question-presentation';
import { massQuestionCandidates } from '../data/production/mass-question-candidates';

describe('question prompt presentation', () => {
  it.each([
    '受付番号 510184\nA：予約があります。\nB：お名前をお願いします。',
    '資料番号 10123\nことばを選んでください。',
    '放送番号 20456\n音声を聞いてください。',
    '文書番号 30789\n案内を読んでください。',
  ])('removes a production-only reference line from %s', prompt => {
    expect(formatQuestionPrompt(prompt)).not.toMatch(/^(?:資料|受付|放送|文書)番号/u);
  });

  it('puts A and B dialogue turns on separate lines', () => {
    expect(formatQuestionPrompt('【受付】 A：予約があります。 B：お名前をお願いします。')).toBe(
      '【受付】\nA：予約があります。\nB：お名前をお願いします。',
    );
  });

  it('preserves existing dialogue line breaks and normal text', () => {
    expect(formatQuestionPrompt('A：こんにちは。\r\nB：こんにちは。')).toBe('A：こんにちは。\nB：こんにちは。');
    expect(formatQuestionPrompt('DATA: 510184')).toBe('DATA: 510184');
  });

  it('does not generate operational reference labels in future production candidates', () => {
    expect(massQuestionCandidates.every(item => !/^(?:資料|受付|放送|文書)番号/u.test(item.prompt))).toBe(true);
  });
});
