const OPERATIONAL_REFERENCE_LINE = /^(?:資料|受付|放送|文書)番号[\t \u00a0]*\d+[\t \u00a0]*(?:\n|$)/u;
const SPEAKER_AFTER_SPACE = /[\t \u00a0]+([ABＡＢ][：:])/gu;
const SPEAKER_AFTER_PUNCTUATION = /([。！？】])([ABＡＢ][：:])/gu;

/**
 * Removes production-only reference labels and preserves learner-facing
 * dialogue turns. This is presentation normalization only: frozen exam
 * snapshots and answer evidence remain unchanged.
 */
export function formatQuestionPrompt(prompt: string): string {
  return prompt
    .replace(/\r\n?/gu, '\n')
    .replace(OPERATIONAL_REFERENCE_LINE, '')
    .replace(SPEAKER_AFTER_SPACE, '\n$1')
    .replace(SPEAKER_AFTER_PUNCTUATION, '$1\n$2')
    .replace(/[\t \u00a0]+$/gmu, '')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}
