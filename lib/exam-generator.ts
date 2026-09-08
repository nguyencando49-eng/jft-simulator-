import { ExamDraft, ExamVersion, QuestionRecord } from './admin-types';
import { allocateBalancedAnswerPositions, applyChoicePermutation, buildChoicePermutation, seededShuffle } from './server/exam-choice-permutation';

export type GenerateResult =
  | { ok: true; version: ExamVersion }
  | { ok: false; errors: string[] };

export { seededShuffle } from './server/exam-choice-permutation';

export function generateExamVersion(
  draft: ExamDraft,
  bank: QuestionRecord[],
  nextVersion = 1,
): GenerateResult {
  const errors: string[] = [];
  const picked: QuestionRecord[] = [];

  for (const rule of draft.rules) {
    const pool = bank.filter(q =>
      q.status === 'approved' &&
      q.section === rule.section &&
      rule.levels.includes(q.level)
    );

    if (pool.length < rule.count) {
      errors.push(`${rule.section}: cần ${rule.count} câu approved nhưng chỉ có ${pool.length}.`);
      continue;
    }

    const seed=`${draft.id}:v${nextVersion}:${rule.section}`;
    picked.push(...seededShuffle(pool,seed).slice(0, rule.count));
  }

  if (errors.length) return { ok: false, errors };

  const createdAt = new Date().toISOString();
  const examFormId = `${draft.id}-v${nextVersion}`;
  const targets = allocateBalancedAnswerPositions(picked);
  return {
    ok: true,
    version: {
      id: examFormId,
      examId: draft.id,
      version: nextVersion,
      title: draft.title,
      durationMinutes: draft.durationMinutes,
      rules: JSON.parse(JSON.stringify(draft.rules)),
      createdAt,
      publishedAt: createdAt,
      questions: picked.map((q,index) => {
        const choicePermutation = buildChoicePermutation({
          question: q,
          examSeed: draft.id,
          examFormId,
          targetAnswerIndex: q.choices.length === 4 ? targets[index] : undefined,
        });
        return {
          questionId: q.id,
          questionVersion: q.version,
          canonicalSnapshot: JSON.parse(JSON.stringify(q)),
          choicePermutation,
          snapshot: JSON.parse(JSON.stringify(applyChoicePermutation(q,choicePermutation))),
        };
      }),
    },
  };
}
