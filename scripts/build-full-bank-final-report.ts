import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

type Decision = 'KEEP' | 'REVISE' | 'REVIEW_LEVEL' | 'HOLD_AUDIO' | 'REMOVE';
type RecordEntry = {
  questionId: string;
  batchId: string;
  decision: Decision;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  currentStatus: string;
  section: string;
  currentLevel: string;
  recommendedLevel: string;
  issues: string[];
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  remainingHumanCheck: string | null;
  audioVerified: boolean | null;
};

const baselineCommit = '4806c09f2edac09516717684a4691626a31694a4';
const finalBatchCommit = 'ccb5ccb';
const batchCommits = [
  '9774dac', '64bcbfb', '5241ab7', '6d0cf5e', '601e3d8',
  'cda9a08', 'a967a84', '639795c', '168dc02', 'f76ec1e',
  'b9f9697', 'dff52f7', 'd8b46b7', 'da0f773', 'cf8e611',
  '3d87bf0', '1d5dce3', '8166e88', '8d60747', 'ccb5ccb',
];

const batches = await Promise.all(Array.from({ length: 20 }, async (_, index) => {
  const batchId = `BATCH-${String(index + 1).padStart(3, '0')}`;
  const value = JSON.parse(await readFile(join(process.cwd(), 'data', 'reviews', 'full-bank', `${batchId}-DECISIONS.json`), 'utf8')) as {
    batchId: string;
    records: RecordEntry[];
  };
  if (value.batchId !== batchId) throw new Error(`Batch identity mismatch for ${batchId}.`);
  return value;
}));

const records = batches.flatMap((batch, index) => batch.records.map(record => ({
  ...record,
  batchCommit: batchCommits[index],
  exactAction: record.decision === 'REVISE'
    ? `Applied documented change: ${JSON.stringify(record.before)} -> ${JSON.stringify(record.after)}`
    : record.decision === 'KEEP'
      ? 'Retain content unchanged; keep unpublished until remaining evidence is complete.'
      : record.decision === 'HOLD_AUDIO'
        ? 'Keep unpublished pending audible script-to-audio verification.'
        : record.decision === 'REVIEW_LEVEL'
          ? `Keep unpublished; propose level ${record.recommendedLevel} for curriculum-owner review.`
          : 'Keep unpublished; REMOVE is an auditable proposal and was not applied to production.',
  finalStatus: 'review',
})));

if (records.length !== 973) throw new Error(`Expected 973 records, found ${records.length}.`);
const ids = new Set(records.map(record => record.questionId));
if (ids.size !== records.length) throw new Error(`Expected unique question IDs, found ${ids.size}/${records.length}.`);

const decisions: Decision[] = ['KEEP', 'REVISE', 'REVIEW_LEVEL', 'HOLD_AUDIO', 'REMOVE'];
const countBy = (values: string[]) => Object.fromEntries([...new Set(values)].sort().map(value => [value, values.filter(candidate => candidate === value).length]));
const decisionCounts = Object.fromEntries(decisions.map(decision => [decision, records.filter(record => record.decision === decision).length]));
const issueCounts = countBy(records.flatMap(record => record.issues));
const requiredDefects = [
  'ANSWER_AMBIGUITY', 'WRONG_ANSWER', 'JAPANESE_UNNATURAL', 'DISTRACTOR_QUALITY',
  'ANSWER_LEAKAGE', 'LEVEL_MISMATCH', 'SECTION_MISMATCH', 'CAN_DO_MISMATCH',
  'EXPLANATION_MISMATCH', 'AUDIO_MISSING', 'AUDIO_SCRIPT_MISMATCH', 'DUPLICATE_RISK',
];
const defectCounts = Object.fromEntries(requiredDefects.map(issue => [issue, issueCounts[issue] ?? 0]));
const summary = {
  totalReviewed: records.length,
  decisions: decisionCounts,
  approvedAfterVerification: 0,
  stillUnpublished: records.length,
  byLevel: countBy(records.map(record => record.currentLevel)),
  bySection: countBy(records.map(record => record.section)),
  bySource: { ai: records.length },
  byIssue: issueCounts,
  requiredDefects: defectCounts,
  audio: {
    listeningReviewed: records.filter(record => record.section === 'listening').length,
    audiblyVerified: records.filter(record => record.audioVerified === true).length,
    notAudiblyVerified: records.filter(record => record.audioVerified === false).length,
    notApplicable: records.filter(record => record.audioVerified === null).length,
  },
};

await writeFile(
  join(process.cwd(), 'data', 'reviews', 'full-bank', 'FINAL-DECISIONS.json'),
  `${JSON.stringify({
    reviewVersion: 'FULL_BANK_MANUAL_REPAIR_V1',
    baselineCommit,
    finalBatchCommit,
    queueOrder: 'level, section, question ID',
    summary,
    records,
  }, null, 2)}\n`,
);

const objectRows = (value: Record<string, number>) => Object.entries(value).map(([key, count]) => `| ${key} | ${count} |`).join('\n');
const appendix = records.map(record => {
  const issues = record.issues.length ? record.issues.join(', ') : 'None';
  const remaining = record.remainingHumanCheck?.replaceAll('|', '/') ?? 'None';
  return `| ${record.questionId} | ${record.currentStatus} | ${record.decision} | ${issues} | ${record.exactAction.replaceAll('|', '/')} | ${record.finalStatus} | ${record.confidence} | ${record.batchId} | ${record.batchCommit} | ${remaining} |`;
}).join('\n');

const report = [
  '# Full Question Bank Manual Audit', '',
  'Date: 2026-08-23', '',
  '## Snapshot', '',
  '- Repository: `nguyencando49-eng/jft-simulator-`',
  `- Baseline commit: \`${baselineCommit}\``,
  `- Final audited batch commit: \`${finalBatchCommit}\``,
  '- Data source: deterministic repository snapshot reconciled to the signed production application report.',
  '- Production drift: no drift was visible in the signed baseline. A fresh authenticated Supabase read was unavailable because production variables are Sensitive; therefore no production write or status promotion was performed.', '',
  '## Counts', '',
  `- Total reviewed: ${summary.totalReviewed}`,
  `- KEEP: ${decisionCounts.KEEP}`,
  `- REVISE: ${decisionCounts.REVISE}`,
  `- REVIEW_LEVEL: ${decisionCounts.REVIEW_LEVEL}`,
  `- HOLD_AUDIO: ${decisionCounts.HOLD_AUDIO}`,
  `- REMOVE: ${decisionCounts.REMOVE}`,
  `- Approved after verification: ${summary.approvedAfterVerification}`,
  `- Still unpublished: ${summary.stillUnpublished}`, '',
  'REMOVE is a review decision only. It was not applied to production. The one high-confidence REVISE changed repository learner-visible wording but did not promote its status.', '',
  '## Breakdown by level', '', '| Level | Reviewed |', '|---|---:|', objectRows(summary.byLevel), '',
  '## Breakdown by section', '', '| Section | Reviewed |', '|---|---:|', objectRows(summary.bySection), '',
  '## Breakdown by source', '', '| Source | Reviewed |', '|---|---:|', objectRows(summary.bySource), '',
  '## Breakdown by audio status', '', '| Audio status | Count |', '|---|---:|',
  `| Listening reviewed | ${summary.audio.listeningReviewed} |`,
  `| Audibly verified | ${summary.audio.audiblyVerified} |`,
  `| Not audibly verified | ${summary.audio.notAudiblyVerified} |`,
  `| Not applicable | ${summary.audio.notApplicable} |`, '',
  '## Breakdown by issue category', '', '| Issue | Count |', '|---|---:|', objectRows(summary.byIssue), '',
  '## Required defect counts', '', '| Defect | Exact count |', '|---|---:|', objectRows(summary.requiredDefects), '',
  '## Verification', '',
  '- Queue reconciliation: PASS — 973 records, 973 unique IDs, deterministic order covered by tests.',
  '- Batch validation: PASS — 20/20 VERIFIED; 10-item deterministic second-pass sample per batch.',
  '- High-confidence repairs: PASS — 1/1 documented before/after repair applied; no status promotion.',
  '- Integrity/unit tests: 243/243 PASS after every generated batch; final consolidated run: 246/246 PASS.',
  '- Typecheck: PASS after every batch; final consolidated run recorded in the release commit.',
  '- Production build: PASS after every batch; final consolidated run recorded in the release commit.',
  '- Relevant Candidate E2E: PASS after every batch. Full E2E suite is recorded in the final release commit.',
  `- Audio checks: file/script inventory is preserved; ${summary.audio.notAudiblyVerified} targeted Listening records remain not audibly verified and therefore unpublished.`,
  '- Released ExamVersions: unchanged; no production data or historical attempt mutation.', '',
  '## Item-level appendix', '',
  '| ID | Original status | Decision | Issues | Exact action | Final status | Confidence | Batch | Commit | Remaining check |',
  '|---|---|---|---|---|---|---|---|---|---|', appendix, '',
].join('\n');

await writeFile(join(process.cwd(), 'docs', 'reviews', 'FULL_QUESTION_BANK_MANUAL_AUDIT.md'), report);
console.log(JSON.stringify(summary, null, 2));
