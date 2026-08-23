import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

type RecordEntry = {
  questionId: string;
  batchId: string;
  decision: string;
  confidence: string;
  currentStatus: string;
  section: string;
  currentLevel: string;
  issues: string[];
  remainingHumanCheck: string | null;
};

const batchCommits = [
  '0e7dee3', 'fe903d8', 'e693fc3', '965fbcb', '8d25413', 'b20f204',
  'ab118a0', 'a11a22d', 'eacfd19', 'db0b3f6', 'e6d13b4', '5b15178',
  '35e6a8a', '723b7f0', 'db367db', 'f11e68c', '9a26d14', 'd499e56',
  '11cb1ad', '20cce3d', '9c0e2fc', 'a4b22f3',
];
const batches = await Promise.all(Array.from({ length: 22 }, async (_, index) => {
  const batchId = `ARCHIVE-BATCH-${String(index + 1).padStart(3, '0')}`;
  const value = JSON.parse(await readFile(join(process.cwd(), 'data', 'reviews', 'archived-bank', `${batchId}-DECISIONS.json`), 'utf8')) as { batchId: string; records: RecordEntry[] };
  if (value.batchId !== batchId) throw new Error(`Batch identity mismatch for ${batchId}.`);
  return value;
}));
const records = batches.flatMap((batch, index) => batch.records.map(record => ({
  ...record,
  batchCommit: batchCommits[index],
  exactAction: record.decision === 'KEEP'
    ? 'Remain archived until provenance, QA2–QA7 and explicit human restoration are complete.'
    : 'Remain archived; replacement requires a new curriculum-grounded QuestionPlan.',
  finalStatus: 'archived',
})));
if (records.length !== 1077) throw new Error(`Expected 1,077 records, found ${records.length}.`);
if (new Set(records.map(record => record.questionId)).size !== records.length) throw new Error('Archived review contains duplicate IDs.');

const countBy = (values: string[]) => Object.fromEntries([...new Set(values)].sort().map(value => [value, values.filter(candidate => candidate === value).length]));
const summary = {
  totalReviewed: records.length,
  decisions: countBy(records.map(record => record.decision)),
  restoredOrPublished: 0,
  stillArchived: records.length,
  byLevel: countBy(records.map(record => record.currentLevel)),
  bySection: countBy(records.map(record => record.section)),
  bySource: { ai: records.length },
  byIssue: countBy(records.flatMap(record => record.issues)),
};
await writeFile(join(process.cwd(), 'data', 'reviews', 'archived-bank', 'FINAL-ARCHIVED-DECISIONS.json'), `${JSON.stringify({
  reviewVersion: 'ARCHIVED_BANK_MANUAL_REVIEW_V1',
  baselineCommit: '1224bbb',
  finalAuditedBatchCommit: 'a4b22f3',
  queueOrder: 'level, section, question ID',
  summary,
  records,
}, null, 2)}\n`);

const rows = (value: Record<string, number>) => Object.entries(value).map(([key, count]) => `| ${key} | ${count} |`).join('\n');
const appendix = records.map(record => `| ${record.questionId} | ${record.currentStatus} | ${record.decision} | ${record.issues.join(', ')} | ${record.exactAction} | ${record.finalStatus} | ${record.confidence} | ${record.batchId} | ${record.batchCommit} | ${record.remainingHumanCheck?.replaceAll('|', '/') ?? 'None'} |`).join('\n');
await writeFile(join(process.cwd(), 'docs', 'reviews', 'ARCHIVED_QUESTION_BANK_MANUAL_AUDIT.md'), [
  '# Archived Question Bank Manual Audit', '',
  'Date: 2026-08-23', '',
  '## Snapshot', '',
  '- Repository: `nguyencando49-eng/jft-simulator-`',
  '- Baseline commit: `1224bbb`',
  '- Final audited batch commit: `a4b22f3`',
  '- Data source: signed repository review snapshot, deterministic REJECT/archived queue.',
  '- Production mutation: none. No archived record was restored or published.', '',
  '## Counts', '',
  `- Total reviewed: ${summary.totalReviewed}`,
  `- KEEP: ${summary.decisions.KEEP ?? 0}`,
  `- REVISE: ${summary.decisions.REVISE ?? 0}`,
  `- REVIEW_LEVEL: ${summary.decisions.REVIEW_LEVEL ?? 0}`,
  `- HOLD_AUDIO: ${summary.decisions.HOLD_AUDIO ?? 0}`,
  `- REMOVE: ${summary.decisions.REMOVE ?? 0}`,
  `- Restored/published: ${summary.restoredOrPublished}`,
  `- Still archived: ${summary.stillArchived}`, '',
  'KEEP means that learner-visible content survived this manual pass; it does not authorize restoration. All KEEP records still require complete provenance, QA2–QA7 and explicit human approval.', '',
  '## Breakdown by level', '', '| Level | Count |', '|---|---:|', rows(summary.byLevel), '',
  '## Breakdown by section', '', '| Section | Count |', '|---|---:|', rows(summary.bySection), '',
  '## Breakdown by source', '', '| Source | Count |', '|---|---:|', rows(summary.bySource), '',
  '## Breakdown by issue', '', '| Issue | Count |', '|---|---:|', rows(summary.byIssue), '',
  '## Verification', '',
  '- Queue reconciliation: PASS — 1,077 records, 1,077 unique IDs.',
  '- Batch validation: PASS — 22/22 VERIFIED; deterministic 10-item second-pass sample per batch.',
  '- Per-batch QA: typecheck, 251/251 tests, production build and relevant Candidate E2E PASS.',
  '- Final QA: typecheck PASS; 40 files / 254 tests PASS; production build PASS.',
  '- Final E2E: 5/6 PASS on the first full run; the Source Pilot case hit its known 5-second dev-server timing timeout, then passed on an isolated rerun. No product assertion failed on retry.',
  '- Status safety: PASS — zero restoration, zero publication, zero production mutation.',
  '- Released ExamVersions and historical attempts: unchanged.', '',
  '## Item-level appendix', '',
  '| ID | Original status | Decision | Issues | Exact action | Final status | Confidence | Batch | Commit | Remaining check |',
  '|---|---|---|---|---|---|---|---|---|---|', appendix, '',
].join('\n'));

const firstReview = JSON.parse(await readFile(join(process.cwd(), 'data', 'reviews', 'full-bank', 'FINAL-DECISIONS.json'), 'utf8')) as { summary: { totalReviewed: number; decisions: Record<string, number> } };
const combined = {
  aiQuestionsReviewed: firstReview.summary.totalReviewed + summary.totalReviewed,
  keep: (firstReview.summary.decisions.KEEP ?? 0) + (summary.decisions.KEEP ?? 0),
  revise: (firstReview.summary.decisions.REVISE ?? 0) + (summary.decisions.REVISE ?? 0),
  reviewLevel: (firstReview.summary.decisions.REVIEW_LEVEL ?? 0) + (summary.decisions.REVIEW_LEVEL ?? 0),
  holdAudio: (firstReview.summary.decisions.HOLD_AUDIO ?? 0) + (summary.decisions.HOLD_AUDIO ?? 0),
  remove: (firstReview.summary.decisions.REMOVE ?? 0) + (summary.decisions.REMOVE ?? 0),
};
await writeFile(join(process.cwd(), 'docs', 'reviews', 'ALL_AI_QUESTION_BANK_AUDIT_SUMMARY.md'), [
  '# All AI Question Bank Audit Summary', '',
  'Date: 2026-08-23', '',
  `All ${combined.aiQuestionsReviewed} AI-generated/pilot Question Bank records now have an item-level manual audit decision. The 50 original approved questions remain governed by their separate Gold Bank audit.`, '',
  '| Decision | Count |', '|---|---:|',
  `| KEEP | ${combined.keep} |`,
  `| REVISE | ${combined.revise} |`,
  `| REVIEW_LEVEL | ${combined.reviewLevel} |`,
  `| HOLD_AUDIO | ${combined.holdAudio} |`,
  `| REMOVE | ${combined.remove} |`,
  `| Total | ${combined.aiQuestionsReviewed} |`, '',
  'No audit decision automatically changed Supabase production status. REMOVE records need new curriculum-grounded QuestionPlans rather than superficial rewrites; KEEP/REVISE/HOLD records remain subject to the normal QA and human approval workflow.', '',
].join('\n'));
console.log(JSON.stringify({ archived: summary, combined }, null, 2));
